import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
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

export const listCommand = new Command('list')
  .description('List uploaded source maps for a specific release')
  .option('-r, --release <version>', 'Release version to list source maps for')
  .option('-p, --project-id <id>', 'Project ID (overrides config)')
  .option('-k, --api-key <key>', 'API key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .action(async (options) => {
    try {
      // Read config from file (priority: local > global > env)
      const config = ConfigManager.getConfig();

      const release = options.release || process.env.KEPLOG_RELEASE;
      const projectId = options.projectId || config.projectId;
      const apiKey = options.apiKey || config.apiKey;
      const apiUrl = options.apiUrl || config.apiUrl || 'https://api.keplog.io';

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

      console.log(chalk.bold.cyan('\n📁 Keplog Source Maps - List\n'));
      console.log(`Release: ${chalk.green(release)}`);
      console.log(`Project ID: ${chalk.gray(projectId)}`);
      console.log(`API URL: ${chalk.gray(apiUrl)}\n`);

      const spinner = ora('Fetching source maps...').start();

      // Fetch source maps from API
      const url = `${apiUrl}/api/v1/cli/projects/${projectId}/sourcemaps?release=${encodeURIComponent(release)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        spinner.fail(chalk.red('Failed to fetch source maps'));
        console.error(chalk.red(`\n✗ Error: ${error.error || 'Unknown error'}\n`));
        process.exit(1);
      }

      const data = await response.json() as ListResponse;
      spinner.succeed(chalk.green('Source maps fetched'));

      // Display results
      console.log(chalk.bold(`\n📦 Source Maps for ${chalk.cyan(data.release)}`));
      console.log(chalk.gray(`Found ${data.count} file${data.count !== 1 ? 's' : ''}\n`));

      if (data.count === 0) {
        console.log(chalk.yellow('No source maps found for this release.\n'));
        console.log(chalk.gray('Upload source maps using: keplog upload --release=' + release + '\n'));
        return;
      }

      // Calculate total size
      let totalSize = 0;
      for (const file of data.source_maps) {
        totalSize += file.Size;
      }

      // Display files
      for (const file of data.source_maps) {
        const size = formatFileSize(file.Size);
        const date = new Date(file.UploadedAt).toLocaleString();
        console.log(`${chalk.green('✓')} ${chalk.white(file.Filename.padEnd(40))} ${chalk.gray(size.padEnd(12))} ${chalk.dim(date)}`);
      }

      console.log(chalk.gray(`\nTotal: ${data.count} files (${formatFileSize(totalSize)})\n`));

    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
