import { Command } from 'commander';
import prompts from 'prompts';
import chalk from 'chalk';
import { ConfigManager } from '../lib/config';

export const initCommand = new Command('init')
  .description('Initialize Keplog configuration for the current project')
  .option('-g, --global', 'Save configuration globally (in ~/.keplogrc)')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    try {
      const isGlobal = options.global || false;
      const force = options.force || false;

      console.log(chalk.bold.cyan('\n🚀 Keplog CLI Configuration\n'));

      // Check if config already exists
      const hasLocal = ConfigManager.hasLocalConfig();
      const hasGlobal = ConfigManager.hasGlobalConfig();

      if (!force) {
        if (isGlobal && hasGlobal) {
          console.log(chalk.yellow('⚠️  Global configuration already exists at ~/.keplogrc'));
          const { overwrite } = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite it?',
            initial: false,
          });

          if (!overwrite) {
            console.log(chalk.gray('\nConfiguration cancelled.'));
            return;
          }
        } else if (!isGlobal && hasLocal) {
          const configPath = ConfigManager.getLocalConfigPath();
          console.log(chalk.yellow(`⚠️  Configuration already exists at ${configPath}`));
          const { overwrite } = await prompts({
            type: 'confirm',
            name: 'overwrite',
            message: 'Do you want to overwrite it?',
            initial: false,
          });

          if (!overwrite) {
            console.log(chalk.gray('\nConfiguration cancelled.'));
            return;
          }
        }
      }

      // Read existing config (if any)
      const existingConfig = ConfigManager.readConfig();

      // Interactive prompts
      console.log(chalk.gray('Get your credentials from: Project Settings → General → Project Credentials\n'));

      const responses = await prompts([
        {
          type: 'text',
          name: 'projectId',
          message: 'Project ID:',
          initial: existingConfig.projectId || '',
          validate: (value: string) => value.trim().length > 0 || 'Project ID is required',
        },
        {
          type: 'password',
          name: 'apiKey',
          message: 'API Key:',
          initial: existingConfig.apiKey || '',
          validate: (value: string) => value.trim().length > 0 || 'API Key is required',
        },
        {
          type: 'text',
          name: 'apiUrl',
          message: 'API URL (optional):',
          initial: existingConfig.apiUrl || 'https://api.keplog.io',
        },
        {
          type: 'text',
          name: 'projectName',
          message: 'Project name (optional):',
          initial: existingConfig.projectName || '',
        },
      ]);

      // Check if user cancelled
      if (!responses.projectId || !responses.apiKey) {
        console.log(chalk.gray('\nConfiguration cancelled.'));
        return;
      }

      // Prepare config
      const config = {
        projectId: responses.projectId.trim(),
        apiKey: responses.apiKey.trim(),
        apiUrl: responses.apiUrl?.trim() || 'https://api.keplog.io',
        projectName: responses.projectName?.trim() || undefined,
      };

      // Save config
      if (isGlobal) {
        ConfigManager.writeGlobalConfig(config);
        console.log(chalk.green('\n✅ Configuration saved globally to ~/.keplogrc'));
      } else {
        ConfigManager.writeLocalConfig(config);
        console.log(chalk.green('\n✅ Configuration saved to .keplog.json'));
        console.log(chalk.gray('\nTip: Add .keplog.json to .gitignore to keep credentials secret'));
      }

      // Display saved config
      console.log(chalk.cyan('\n📝 Saved configuration:'));
      console.log(chalk.gray(`   Project ID: ${config.projectId}`));
      console.log(chalk.gray(`   API Key: ${'*'.repeat(Math.min(config.apiKey.length, 20))}...`));
      console.log(chalk.gray(`   API URL: ${config.apiUrl}`));
      if (config.projectName) {
        console.log(chalk.gray(`   Project Name: ${config.projectName}`));
      }

      console.log(chalk.cyan('\n💡 Next steps:'));
      console.log(chalk.gray('   1. Upload source maps: keplog upload --release=v1.0.0 --files="dist/**/*.map"'));
      console.log(chalk.gray('   2. View help: keplog upload --help'));
      console.log();

    } catch (error: any) {
      if (error.message === 'canceled') {
        console.log(chalk.gray('\n\nConfiguration cancelled.'));
        process.exit(0);
      }

      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });
