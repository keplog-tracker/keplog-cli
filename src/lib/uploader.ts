import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import FormData from 'form-data';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';

interface UploadOptions {
  release: string;
  filePatterns: string[];
  projectId: string;
  apiKey: string;
  apiUrl: string;
  verbose: boolean;
}

interface UploadResponse {
  uploaded: string[];
  errors: string[];
  release: string;
  count: number;
  error?: string;
}

export async function uploadSourceMaps(options: UploadOptions): Promise<void> {
  const { release, filePatterns, projectId, apiKey, apiUrl, verbose } = options;

  console.log(chalk.bold.cyan('\n📦 Keplog Source Map Uploader\n'));
  console.log(chalk.gray(`Release: ${release}`));
  console.log(chalk.gray(`Project ID: ${projectId}`));
  console.log(chalk.gray(`API URL: ${apiUrl}\n`));

  // Find all matching files
  const spinner = ora('Finding source map files...').start();
  const allFiles: string[] = [];

  for (const pattern of filePatterns) {
    try {
      const matches = await glob(pattern, { nodir: true });
      if (verbose) {
        spinner.info(`Pattern "${pattern}" matched ${matches.length} file(s)`);
      }
      allFiles.push(...matches);
    } catch (error: any) {
      spinner.fail(`Invalid glob pattern: ${pattern}`);
      throw error;
    }
  }

  // Remove duplicates
  const uniqueFiles = [...new Set(allFiles)];

  if (uniqueFiles.length === 0) {
    spinner.fail('No source map files found');
    console.log(chalk.yellow('\n⚠️  No files matched the specified patterns'));
    console.log(chalk.gray('\nTip: Make sure your patterns are correct:'));
    console.log(chalk.gray('  --files="dist/**/*.map"'));
    console.log(chalk.gray('  --files="build/*.map"'));
    process.exit(1);
  }

  spinner.succeed(`Found ${uniqueFiles.length} source map file(s)`);

  // Filter only .map files
  const mapFiles = uniqueFiles.filter(file => file.endsWith('.map'));

  if (mapFiles.length === 0) {
    console.log(chalk.yellow('\n⚠️  No .map files found'));
    process.exit(1);
  }

  if (mapFiles.length !== uniqueFiles.length) {
    console.log(chalk.yellow(`\n⚠️  Skipped ${uniqueFiles.length - mapFiles.length} non-.map file(s)`));
  }

  // Display files to upload
  if (verbose) {
    console.log(chalk.cyan('\n📁 Files to upload:'));
    mapFiles.forEach((file, index) => {
      const stats = fs.statSync(file);
      const size = formatFileSize(stats.size);
      console.log(chalk.gray(`  ${index + 1}. ${file} (${size})`));
    });
    console.log();
  }

  // Create form data
  const uploadSpinner = ora(`Uploading ${mapFiles.length} file(s) to Keplog...`).start();

  try {
    const formData = new FormData();
    formData.append('release', release);

    // Add all files
    for (const filePath of mapFiles) {
      const fileName = path.basename(filePath);
      const fileStream = fs.createReadStream(filePath);
      formData.append('files', fileStream, fileName);
    }

    // Upload to API
    const url = `${apiUrl}/api/v1/cli/projects/${projectId}/sourcemaps`;

    const response = await axios.post(url, formData, {
      headers: {
        'X-API-Key': apiKey,
        ...formData.getHeaders(),
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const data = response.data as UploadResponse;

    uploadSpinner.succeed('Upload complete!');

    // Display results
    console.log(chalk.bold.green('\n✅ Upload Complete!\n'));
    console.log(chalk.gray(`Release: ${data.release}`));
    console.log(chalk.gray(`Uploaded: ${data.count} file(s)\n`));

    if (data.uploaded && data.uploaded.length > 0) {
      console.log(chalk.cyan('📁 Successfully uploaded:'));
      data.uploaded.forEach(filename => {
        console.log(chalk.green(`   ✓ ${filename}`));
      });
    }

    if (data.errors && data.errors.length > 0) {
      console.log(chalk.yellow('\n⚠️  Errors:'));
      data.errors.forEach(error => {
        console.log(chalk.red(`   ✗ ${error}`));
      });
      process.exit(1);
    }

    console.log(chalk.cyan(`\n💡 Source maps will be used automatically when processing errors for release ${data.release}\n`));

  } catch (error: any) {
    uploadSpinner.fail('Upload failed');

    if (axios.isAxiosError(error)) {
      if (error.code === 'ENOTFOUND') {
        throw new Error(`Could not connect to ${apiUrl}. Please check your internet connection.`);
      } else if (error.code === 'ECONNREFUSED') {
        throw new Error(`Connection refused to ${apiUrl}. Please check the API URL.`);
      } else if (error.response) {
        // Server responded with error
        const data = error.response.data;
        throw new Error(data.error || `HTTP ${error.response.status}: ${error.response.statusText}`);
      } else if (error.request) {
        // Request made but no response
        throw new Error(`No response from server. Please check your internet connection.`);
      }
    }

    throw error;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}
