import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import prompts from 'prompts';
import { ConfigManager } from '../lib/config.js';

interface SourceMap {
  Filename: string;
  Size: number;
  UploadedAt: string;
}

interface ListResponse {
  source_maps: SourceMap[];
  release: string;
  count: number;
}

export const deleteCommand = new Command('delete')
  .description('Delete source maps for a specific release')
  .option('-r, --release <version>', 'Release version')
  .option('-f, --file <filename>', 'Specific file to delete (optional - omit to delete all)')
  .option('-y, --yes', 'Skip confirmation prompt')
  .option('-p, --project-id <id>', 'Project ID (overrides config)')
  .option('-k, --api-key <key>', 'API key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .action(async (options) => {
    try {
      // Read config from file (priority: local > global > env)
      const config = ConfigManager.getConfig();

      const release = options.release || process.env.KEPLOG_RELEASE;
      const filename = options.file;
      const skipConfirm = options.yes || false;
      const projectId = options.projectId || config.projectId;
      const apiKey = options.apiKey || config.apiKey;
      const apiUrl = options.apiUrl || config.apiUrl || 'https://api.keplog.com';

      // Validate required parameters
      if (!projectId) {
        console.error(chalk.red('\n✗ Error: Project ID is required\n'));
        console.log('Options:');
        console.log('  1. Run: keplog init (recommended)');
        console.log('  2. Use flag: --project-id=<your-project-id>');
        console.log('  3. Set env: KEPLOG_PROJECT_ID=<your-project-id>\n');
        process.exit(1);
      }

      if (!apiKey) {
        console.error(chalk.red('\n✗ Error: API key is required\n'));
        console.log('Options:');
        console.log('  1. Run: keplog init (recommended)');
        console.log('  2. Use flag: --api-key=<your-api-key>');
        console.log('  3. Set env: KEPLOG_API_KEY=<your-api-key>\n');
        process.exit(1);
      }

      if (!release) {
        console.error(chalk.red('\n✗ Error: Release version is required\n'));
        console.log('Options:');
        console.log('  1. Use flag: --release=v1.0.0');
        console.log('  2. Set env: KEPLOG_RELEASE=v1.0.0\n');
        process.exit(1);
      }

      console.log(chalk.bold.red('\n🗑️  Keplog Source Maps - Delete\n'));
      console.log(`Release: ${chalk.yellow(release)}`);
      console.log(`Project ID: ${chalk.gray(projectId)}`);

      if (filename) {
        console.log(`File: ${chalk.yellow(filename)}\n`);
      } else {
        console.log(chalk.yellow('Target: All source maps for this release\n'));
      }

      // If deleting all files, fetch and show the list first
      let filesToDelete: string[] = [];
      if (!filename) {
        const spinner = ora('Fetching source maps...').start();

        const listUrl = `${apiUrl}/api/v1/cli/projects/${projectId}/sourcemaps?release=${encodeURIComponent(release)}`;
        const listResponse = await fetch(listUrl, {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
          },
        });

        if (!listResponse.ok) {
          const error = await listResponse.json() as any;
          spinner.fail(chalk.red('Failed to fetch source maps'));
          console.error(chalk.red(`\n✗ Error: ${error.error || 'Unknown error'}\n`));
          process.exit(1);
        }

        const data = await listResponse.json() as ListResponse;
        spinner.succeed(`Found ${data.count} source map${data.count !== 1 ? 's' : ''}`);

        if (data.count === 0) {
          console.log(chalk.yellow('\nNo source maps found for this release.\n'));
          return;
        }

        filesToDelete = data.source_maps.map(f => f.Filename);

        console.log(chalk.gray('\nFiles to be deleted:'));
        for (const file of data.source_maps) {
          console.log(`  ${chalk.red('✗')} ${file.Filename}`);
        }
        console.log('');
      } else {
        filesToDelete = [filename];
      }

      // Confirmation prompt (unless --yes flag is used)
      if (!skipConfirm) {
        const message = filename
          ? `Are you sure you want to delete ${chalk.yellow(filename)} from release ${chalk.yellow(release)}?`
          : `Are you sure you want to delete ${chalk.red.bold('ALL')} ${filesToDelete.length} source maps from release ${chalk.yellow(release)}?`;

        const response = await prompts({
          type: 'confirm',
          name: 'confirmed',
          message,
          initial: false,
        });

        if (!response.confirmed) {
          console.log(chalk.gray('\nDeletion cancelled.\n'));
          return;
        }
      }

      // Delete files
      let deletedCount = 0;
      let failedCount = 0;
      const errors: string[] = [];

      console.log(chalk.gray('\nDeleting source maps...\n'));

      for (const file of filesToDelete) {
        const spinner = ora(`Deleting ${file}...`).start();

        try {
          const deleteUrl = `${apiUrl}/api/v1/cli/projects/${projectId}/sourcemaps/${encodeURIComponent(file)}?release=${encodeURIComponent(release)}`;
          const response = await fetch(deleteUrl, {
            method: 'DELETE',
            headers: {
              'X-API-Key': apiKey,
            },
          });

          if (!response.ok) {
            const error = await response.json() as any;
            throw new Error(error.error || 'Unknown error');
          }

          spinner.succeed(chalk.green(`Deleted ${file}`));
          deletedCount++;
        } catch (error: any) {
          spinner.fail(chalk.red(`Failed to delete ${file}`));
          errors.push(`${file}: ${error.message}`);
          failedCount++;
        }
      }

      // Summary
      console.log(chalk.bold('\n✅ Deletion Complete!\n'));
      console.log(`Release: ${chalk.yellow(release)}`);
      console.log(`Deleted: ${chalk.green(deletedCount)} file${deletedCount !== 1 ? 's' : ''}`);

      if (failedCount > 0) {
        console.log(`Failed: ${chalk.red(failedCount)} file${failedCount !== 1 ? 's' : ''}\n`);
        console.log(chalk.red.bold('⚠️  Errors:'));
        for (const error of errors) {
          console.log(`   ${chalk.red('✗')} ${error}`);
        }
      }

      console.log('');

    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });
