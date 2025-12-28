#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { uploadCommand } from './commands/upload.js';
import { listCommand } from './commands/list.js';
import { deleteCommand } from './commands/delete.js';
import { releasesCommand } from './commands/releases.js';
import { issuesCommand } from './commands/issues.js';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const program = new Command();

program
  .name('keplog')
  .description('Official Keplog CLI for error tracking and source map management')
  .version('1.0.0');

// Add commands
program.addCommand(initCommand);
program.addCommand(uploadCommand);
program.addCommand(listCommand);
program.addCommand(deleteCommand);
program.addCommand(releasesCommand);
program.addCommand(issuesCommand);

// Parse command line arguments
program.parse(process.argv);
