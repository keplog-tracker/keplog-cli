import { Command } from 'commander';
import { uploadSourceMaps } from '../lib/uploader';
import { ConfigManager } from '../lib/config';
import chalk from 'chalk';

export const uploadCommand = new Command('upload')
  .description('Upload source maps for a specific release')
  .option('-r, --release <version>', 'Release version (e.g., v1.0.0)')
  .option('-f, --files <patterns...>', 'Source map file patterns (supports glob)')
  .option('-p, --project-id <id>', 'Project ID (overrides config)')
  .option('-k, --api-key <key>', 'API Key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .option('-v, --verbose', 'Verbose output')
  .action(async (options) => {
    try {
      // Read config from file (priority: local > global > env)
      const config = ConfigManager.getConfig();

      // Validate required options
      const release = options.release;
      const files = options.files || [];
      const projectId = options.projectId || config.projectId;
      const apiKey = options.apiKey || config.apiKey;
      const apiUrl = options.apiUrl || config.apiUrl || 'https://api.keplog.io';
      const verbose = options.verbose || false;

      if (!release) {
        console.error(chalk.red('❌ Error: --release is required'));
        console.log(chalk.gray('\nExample:'));
        console.log(chalk.gray('  keplog upload --release=v1.0.0 --files="dist/**/*.map"'));
        process.exit(1);
      }

      if (!files || files.length === 0) {
        console.error(chalk.red('❌ Error: --files is required'));
        console.log(chalk.gray('\nExample:'));
        console.log(chalk.gray('  keplog upload --release=v1.0.0 --files="dist/**/*.map"'));
        process.exit(1);
      }

      if (!projectId) {
        console.error(chalk.red('❌ Error: Project ID is required'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  1. Run: keplog init (recommended)'));
        console.log(chalk.gray('  2. Use flag: --project-id=<your-project-id>'));
        console.log(chalk.gray('  3. Set env: KEPLOG_PROJECT_ID=<your-project-id>'));
        process.exit(1);
      }

      if (!apiKey) {
        console.error(chalk.red('❌ Error: API Key is required'));
        console.log(chalk.gray('\nOptions:'));
        console.log(chalk.gray('  1. Run: keplog init (recommended)'));
        console.log(chalk.gray('  2. Use flag: --api-key=<your-api-key>'));
        console.log(chalk.gray('  3. Set env: KEPLOG_API_KEY=<your-api-key>'));
        process.exit(1);
      }

      // Upload source maps
      await uploadSourceMaps({
        release,
        filePatterns: files,
        projectId,
        apiKey,
        apiUrl,
        verbose,
      });

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      if (error.stack && process.env.DEBUG) {
        console.error(chalk.gray(error.stack));
      }
      process.exit(1);
    }
  });
