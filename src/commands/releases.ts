import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../lib/config.js';

interface ReleaseInfo {
  Release: string;
  FileCount: number;
  TotalSize: number;
  LastModified: string;
}

interface ReleasesResponse {
  releases: ReleaseInfo[];
  count: number;
}

export const releasesCommand = new Command('releases')
  .description('List all releases with uploaded source maps')
  .option('-p, --project-id <id>', 'Project ID (overrides config)')
  .option('-k, --api-key <key>', 'API key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .action(async (options) => {
    try {
      // Read config from file (priority: local > global > env)
      const config = ConfigManager.getConfig();

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

      console.log(chalk.bold.cyan('\n📦 Keplog Releases\n'));
      console.log(`Project ID: ${chalk.gray(projectId)}`);
      console.log(`API URL: ${chalk.gray(apiUrl)}\n`);

      const spinner = ora('Fetching releases...').start();

      // Fetch releases from API
      const url = `${apiUrl}/api/v1/cli/projects/${projectId}/sourcemaps/releases`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        spinner.fail(chalk.red('Failed to fetch releases'));
        console.error(chalk.red(`\n✗ Error: ${error.error || 'Unknown error'}\n`));
        process.exit(1);
      }

      const data = await response.json() as ReleasesResponse;
      spinner.succeed(chalk.green('Releases fetched'));

      // Display results
      console.log(chalk.bold(`\n📋 Releases with Source Maps`));
      console.log(chalk.gray(`Found ${data.count} release${data.count !== 1 ? 's' : ''}\n`));

      if (data.count === 0) {
        console.log(chalk.yellow('No releases found.\n'));
        console.log(chalk.gray('Upload source maps using: keplog upload --release=v1.0.0 --files="dist/**/*.map"\n'));
        return;
      }

      // Calculate total size across all releases
      let totalSize = 0;
      let totalFiles = 0;
      for (const release of data.releases) {
        totalSize += release.TotalSize;
        totalFiles += release.FileCount;
      }

      // Display releases
      for (const release of data.releases) {
        const size = formatFileSize(release.TotalSize);
        const date = new Date(release.LastModified).toLocaleDateString();
        const fileText = `${release.FileCount} file${release.FileCount !== 1 ? 's' : ''}`;

        console.log(
          `${chalk.cyan(release.Release.padEnd(30))} ` +
          `${chalk.gray(fileText.padEnd(12))} ` +
          `${chalk.yellow(size.padEnd(12))} ` +
          `${chalk.dim(date)}`
        );
      }

      console.log(chalk.gray(`\nTotal: ${data.count} releases, ${totalFiles} files (${formatFileSize(totalSize)})\n`));

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
