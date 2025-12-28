import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ConfigManager } from '../lib/config.js';

interface Issue {
  id: string;
  title: string;
  status: string;
  level: string;
  first_seen: string;
  last_seen: string;
  occurrences: number;
  project_id: string;
  assigned_user_name?: string;
  assigned_team_name?: string;
  snoozed_until?: string;
}

interface Frame {
  file?: string;
  line?: number;
  function?: string;
  class?: string;
  type?: string;
  code_snippet?: { [lineNumber: string]: string } | null;
}

interface MappedFrame {
  filename?: string;
  line_number?: number;
  column_number?: number;
  function?: string;
  source_filename?: string;
  source_line_number?: number;
  source_column?: number;
  source_function?: string;
  source_code?: string;
  pre_context?: string[];
  post_context?: string[];
  mapped?: boolean;
}

interface ErrorContext {
  frames?: Frame[];
  [key: string]: any;
}

interface MappedStackTrace {
  frames?: MappedFrame[];
  release?: string;
  applied_at?: string;
}

interface IssueDetails extends Issue {
  fingerprint: string;
  created_at: string;
  updated_at: string;
  context?: ErrorContext;
  stack_trace?: string;
  mapped_stack_trace?: MappedStackTrace;
}

interface ListIssuesResponse {
  issues: Issue[];
}

interface GetIssueResponse {
  issue: IssueDetails;
}

// List subcommand
const listSubcommand = new Command('list')
  .description('List issues for a project')
  .option('-p, --project-id <id>', 'Project ID (overrides config)')
  .option('-k, --api-key <key>', 'API key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .option('-s, --status <status>', 'Filter by status (open, in_progress, resolved, ignored)', 'open')
  .option('-l, --limit <number>', 'Number of issues to fetch', '50')
  .option('--offset <number>', 'Offset for pagination', '0')
  .option('--from <date>', 'Filter from date (YYYY-MM-DD)')
  .option('--to <date>', 'Filter to date (YYYY-MM-DD)')
  .action(async (options) => {
    try {
      // Read config from file
      const config = ConfigManager.getConfig();

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

      console.log(chalk.bold.cyan('\n🐛 Keplog Issues - List\n'));
      console.log(`Project ID: ${chalk.gray(projectId)}`);
      console.log(`Status: ${chalk.yellow(options.status)}`);
      console.log(`Limit: ${chalk.gray(options.limit)}\n`);

      const spinner = ora('Fetching issues...').start();

      // Build query parameters
      const params = new URLSearchParams({
        status: options.status,
        limit: options.limit,
        offset: options.offset,
      });

      if (options.from) {
        params.append('date_from', options.from);
      }
      if (options.to) {
        params.append('date_to', options.to);
      }

      // Fetch issues from API
      const url = `${apiUrl}/api/v1/projects/${projectId}/issues?${params.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        spinner.fail(chalk.red('Failed to fetch issues'));
        console.error(chalk.red(`\n✗ Error: ${error.error || 'Unknown error'}\n`));
        process.exit(1);
      }

      const data = await response.json() as ListIssuesResponse;
      spinner.succeed(chalk.green('Issues fetched'));

      // Display results
      if (!data.issues || data.issues.length === 0) {
        console.log(chalk.yellow('\nNo issues found.\n'));
        return;
      }

      console.log(chalk.bold(`\n📋 Found ${chalk.cyan(data.issues.length)} issue${data.issues.length !== 1 ? 's' : ''}\n`));

      // Display table header
      const idWidth = 10;
      const titleWidth = 50;
      const statusWidth = 12;
      const levelWidth = 10;
      const occWidth = 8;
      const lastSeenWidth = 20;

      console.log(
        chalk.gray(
          'ID'.padEnd(idWidth) +
          'TITLE'.padEnd(titleWidth) +
          'STATUS'.padEnd(statusWidth) +
          'LEVEL'.padEnd(levelWidth) +
          'COUNT'.padEnd(occWidth) +
          'LAST SEEN'
        )
      );
      console.log(chalk.gray('─'.repeat(idWidth + titleWidth + statusWidth + levelWidth + occWidth + lastSeenWidth)));

      // Display issues
      for (const issue of data.issues) {
        const shortId = issue.id.substring(0, 8);
        const title = truncate(issue.title, titleWidth - 2);
        const status = colorStatus(issue.status).padEnd(statusWidth);
        const level = colorLevel(issue.level).padEnd(levelWidth);
        const count = issue.occurrences.toString().padEnd(occWidth);
        const lastSeen = formatDate(issue.last_seen);

        console.log(
          chalk.white(shortId.padEnd(idWidth)) +
          title.padEnd(titleWidth) +
          status +
          level +
          chalk.cyan(count) +
          chalk.gray(lastSeen)
        );
      }

      console.log(chalk.gray(`\nShowing ${data.issues.length} issue${data.issues.length !== 1 ? 's' : ''} (offset: ${options.offset})\n`));
      console.log(chalk.dim('View details: keplog issues show <issue-id>\n'));

    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Show subcommand
const showSubcommand = new Command('show')
  .description('Show detailed information about an issue')
  .argument('<issue-id>', 'Issue ID to display')
  .option('-k, --api-key <key>', 'API key (overrides config)')
  .option('-u, --api-url <url>', 'API URL (overrides config)')
  .option('--show-minified', 'Show minified stack trace (if source maps available)')
  .action(async (issueId: string, options) => {
    try {
      // Read config from file
      const config = ConfigManager.getConfig();

      const apiKey = options.apiKey || config.apiKey;
      const apiUrl = options.apiUrl || config.apiUrl || 'https://api.keplog.com';

      // Validate required parameters
      if (!apiKey) {
        console.error(chalk.red('\n✗ Error: API key is required\n'));
        console.log('Options:');
        console.log('  1. Run: keplog init (recommended)');
        console.log('  2. Use flag: --api-key=<your-api-key>');
        console.log('  3. Set env: KEPLOG_API_KEY=<your-api-key>\n');
        process.exit(1);
      }

      console.log(chalk.bold.cyan('\n🐛 Keplog Issue Details\n'));

      const spinner = ora('Fetching issue details...').start();

      // Fetch issue from API
      const url = `${apiUrl}/api/v1/issues/${issueId}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
        },
      });

      if (!response.ok) {
        const error = await response.json() as any;
        spinner.fail(chalk.red('Failed to fetch issue'));
        console.error(chalk.red(`\n✗ Error: ${error.error || 'Unknown error'}\n`));
        process.exit(1);
      }

      const data = await response.json() as GetIssueResponse;
      const issue = data.issue;
      spinner.succeed(chalk.green('Issue fetched'));

      // Display issue details
      console.log(chalk.bold(`\n📌 ${issue.title}\n`));
      console.log(`${chalk.gray('ID:')}           ${chalk.white(issue.id)}`);
      console.log(`${chalk.gray('Status:')}       ${colorStatus(issue.status)}`);
      console.log(`${chalk.gray('Level:')}        ${colorLevel(issue.level)}`);
      console.log(`${chalk.gray('Occurrences:')}  ${chalk.cyan(issue.occurrences)}`);
      console.log(`${chalk.gray('First Seen:')}   ${chalk.white(formatDateLong(issue.first_seen))}`);
      console.log(`${chalk.gray('Last Seen:')}    ${chalk.white(formatDateLong(issue.last_seen))}`);

      if (issue.assigned_user_name) {
        console.log(`${chalk.gray('Assigned To:')}  ${chalk.white(issue.assigned_user_name)}`);
      } else if (issue.assigned_team_name) {
        console.log(`${chalk.gray('Assigned To:')}  ${chalk.white(issue.assigned_team_name)} ${chalk.dim('(team)')}`);
      }

      if (issue.snoozed_until) {
        console.log(`${chalk.gray('Snoozed:')}      ${chalk.yellow('Until ' + formatDateLong(issue.snoozed_until))}`);
      }

      // Display source-mapped stack trace if available
      const hasMappedTrace = issue.mapped_stack_trace?.frames && issue.mapped_stack_trace.frames.length > 0;
      const showOriginal = hasMappedTrace && !options.showMinified;

      if (showOriginal) {
        console.log(chalk.bold.green('\n✓ Source Maps Applied'));
        if (issue.mapped_stack_trace?.release) {
          console.log(chalk.gray(`Release: ${issue.mapped_stack_trace.release}`));
        }
        console.log(chalk.bold('\n📚 Stack Trace (Original Source):\n'));

        for (const frame of issue.mapped_stack_trace!.frames!) {
          if (frame.mapped && frame.source_filename) {
            // Source-mapped frame
            console.log(chalk.green('  ✓ [MAPPED]'));
            console.log(`    ${chalk.white(frame.source_function || 'anonymous')}`);
            console.log(chalk.gray(`    ${frame.source_filename}:${frame.source_line_number}:${frame.source_column || 0}`));

            // Show source code if available
            if (frame.source_code) {
              console.log(chalk.dim('\n    Source Code:'));

              // Pre-context
              if (frame.pre_context && frame.pre_context.length > 0) {
                const startLine = (frame.source_line_number || 0) - frame.pre_context.length;
                frame.pre_context.forEach((line, i) => {
                  const lineNum = startLine + i;
                  console.log(chalk.gray(`    ${String(lineNum).padStart(4)} │ ${line}`));
                });
              }

              // Error line
              console.log(chalk.red(`  → ${String(frame.source_line_number).padStart(4)} │ ${frame.source_code}`));

              // Post-context
              if (frame.post_context && frame.post_context.length > 0) {
                frame.post_context.forEach((line, i) => {
                  const lineNum = (frame.source_line_number || 0) + i + 1;
                  console.log(chalk.gray(`    ${String(lineNum).padStart(4)} │ ${line}`));
                });
              }
              console.log('');
            }
          } else {
            // Unmapped frame
            console.log(chalk.yellow('  ○'));
            console.log(`    ${chalk.white(frame.function || 'anonymous')}`);
            console.log(chalk.gray(`    ${frame.filename || 'unknown'}:${frame.line_number || 0}`));
          }
          console.log('');
        }
      } else if (issue.context?.frames && issue.context.frames.length > 0) {
        // Laravel/PHP style frames
        console.log(chalk.bold('\n📚 Stack Trace:\n'));

        for (const frame of issue.context.frames) {
          const funcName = frame.class
            ? `${frame.class}${frame.type || '::'}${frame.function}`
            : (frame.function || 'anonymous');

          console.log(chalk.white(`  ${funcName}`));
          console.log(chalk.gray(`  ${frame.file || 'unknown'}:${frame.line || '?'}`));

          // Show code snippet if available
          if (frame.code_snippet) {
            const lines = Object.entries(frame.code_snippet).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));

            if (lines.length > 0) {
              console.log(chalk.dim('\n  Code:'));
              for (const [lineNum, code] of lines) {
                const isErrorLine = parseInt(lineNum) === frame.line;
                if (isErrorLine) {
                  console.log(chalk.red(`→ ${lineNum.padStart(4)} │ ${code}`));
                } else {
                  console.log(chalk.gray(`  ${lineNum.padStart(4)} │ ${code}`));
                }
              }
              console.log('');
            }
          }
          console.log('');
        }
      } else if (issue.stack_trace) {
        // Plain text stack trace
        console.log(chalk.bold('\n📚 Stack Trace:\n'));
        console.log(chalk.gray(issue.stack_trace));
      }

      if (hasMappedTrace && !showOriginal) {
        console.log(chalk.dim('\n💡 Tip: Remove --show-minified to see original source code\n'));
      }

      console.log('');

    } catch (error: any) {
      console.error(chalk.red(`\n✗ Error: ${error.message}\n`));
      process.exit(1);
    }
  });

// Main issues command
export const issuesCommand = new Command('issues')
  .description('Manage and view issues')
  .addCommand(listSubcommand)
  .addCommand(showSubcommand);

// Helper functions
function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

function colorStatus(status: string): string {
  switch (status) {
    case 'open':
      return chalk.red(status);
    case 'in_progress':
      return chalk.yellow(status);
    case 'resolved':
      return chalk.green(status);
    case 'ignored':
      return chalk.gray(status);
    default:
      return chalk.white(status);
  }
}

function colorLevel(level: string): string {
  switch (level) {
    case 'critical':
      return chalk.red.bold(level);
    case 'error':
      return chalk.red(level);
    case 'warning':
      return chalk.yellow(level);
    case 'info':
      return chalk.blue(level);
    default:
      return chalk.white(level);
  }
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
}

function formatDateLong(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}
