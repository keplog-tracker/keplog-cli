# Keplog CLI

Command-line tool for [Keplog](https://keplog.io) - Upload source maps, manage releases, and view issues directly from your terminal.

## Installation

Install globally to use the `keplog` command anywhere:

```bash
npm install -g @keplog/cli
```

Or add it to your project:

```bash
npm install --save-dev @keplog/cli
```

You can also use it without installing:

```bash
npx @keplog/cli upload --release=v1.0.0 --files="dist/**/*.map"
```

## Getting Started

First, run the setup wizard to configure your project:

```bash
keplog init
```

This will ask for your Project ID and API Key, then save them to `.keplog.json`. You can also use `keplog init --global` to save credentials to `~/.keplogrc` in your home directory.

Once configured, upload your source maps:

```bash
keplog upload --release=v1.0.0 --files="dist/**/*.map"
```

That's it. Your source maps are now available for stack trace transformation in Keplog.

## Commands

### keplog init

Configure your project with Keplog credentials.

```bash
keplog init                    # Save to .keplog.json (project-specific)
keplog init --global           # Save to ~/.keplogrc (user-wide)
keplog init --force            # Overwrite existing config
```

The CLI looks for config in this order:
1. Command-line flags
2. `.keplog.json` (local project)
3. `~/.keplogrc` (global)
4. Environment variables

### keplog upload

Upload source maps for a release.

```bash
keplog upload --release=v1.0.0 --files="dist/**/*.map"
```

**Options:**
- `--release` (required) - Release version
- `--files` (required) - Glob pattern(s) for source map files
- `--project-id` - Override configured project ID
- `--api-key` - Override configured API key
- `--api-url` - Custom API endpoint
- `--verbose` - Show detailed output

**Examples:**

```bash
# Upload all .map files in dist/
keplog upload --release=v1.0.0 --files="dist/**/*.map"

# Multiple patterns
keplog upload --release=v1.0.0 --files="dist/js/**/*.map" --files="dist/css/**/*.map"

# With explicit credentials
keplog upload --release=v1.0.0 --files="build/**/*.map" --project-id="abc-123" --api-key="proj_xyz"
```

### keplog list

Show all source maps uploaded for a release.

```bash
keplog list --release=v1.0.0
```

Displays filename, size, and upload date for each source map.

### keplog delete

Remove source maps for a release.

```bash
keplog delete --release=v1.0.0                    # Delete all maps for this release
keplog delete --release=v1.0.0 --file="app.js.map" # Delete specific file
keplog delete --release=v1.0.0 --yes              # Skip confirmation
```

Be careful with this one - it will ask for confirmation unless you use `--yes`.

### keplog releases

List all releases that have source maps.

```bash
keplog releases
```

Shows release versions, file count, total size, and last modified date.

### keplog issues

View and manage issues in your project.

**List issues:**
```bash
keplog issues list                                 # Show open issues
keplog issues list --status=resolved               # Filter by status
keplog issues list --limit=100 --offset=50         # Pagination
keplog issues list --from=2024-01-01 --to=2024-12-31  # Date range
keplog issues list --format=json                   # JSON output
```

**Show issue details:**
```bash
keplog issues show <issue-id>                      # Full details with stack trace
keplog issues show <issue-id> --show-minified      # Show minified trace
keplog issues show <issue-id> --format=json        # JSON output
```

If source maps are available, you'll see the original source code with syntax highlighting.

**List issue events:**
```bash
keplog issues events <issue-id>                    # Show all occurrences
keplog issues events <issue-id> --limit=10         # Limit results
```

## Using in Build Scripts

Add source map uploads to your package.json:

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "upload-maps": "keplog upload --release=$npm_package_version --files='dist/**/*.map'",
    "deploy": "npm run build && npm run upload-maps"
  }
}
```

## Environment Variables

You can use environment variables instead of config files:

```bash
export KEPLOG_PROJECT_ID=abc-123-def-456
export KEPLOG_API_KEY=proj_xyz789
export KEPLOG_API_URL=https://api.keplog.io  # optional
```

Or create a `.env` file:

```env
KEPLOG_PROJECT_ID=abc-123-def-456
KEPLOG_API_KEY=proj_xyz789
```

Find your credentials in your Keplog dashboard under Settings → General → Project Credentials.

## Glob Patterns

The `--files` option uses glob patterns:

```bash
*.map                  # All .map files in current directory
**/*.map              # All .map files recursively
dist/**/*.map         # All .map files in dist/
{js,css}/**/*.map     # .map files in js/ and css/ directories
```

## Tips

**Match your release version** - Make sure the version you upload matches what your app reports:

```javascript
keplog.init({
  apiKey: 'your-api-key',
  release: 'v1.2.3'  // Same version you used in upload command
});
```

**Don't deploy source maps to production** - Upload them to Keplog, then delete before deploying:

```bash
keplog upload --release=v1.0.0 --files="dist/**/*.map"
rm dist/**/*.map
# Now deploy without source maps
```

**Use environment variables for secrets** - Don't put API keys in your shell history or commit them to git. Use environment variables or CI secrets instead.

## Troubleshooting

**"Source map integration not configured"**

You need to enable a storage plugin in your Keplog project settings first. Go to Project Settings → Plugins and configure S3, GCS, or HTTP storage.

**"No files matched the patterns"**

Check your glob pattern and make sure the files exist:

```bash
ls -la dist/**/*.map
```

**"Project ID mismatch"**

Your API key needs to belong to the project you're uploading to. Double-check both values in your dashboard.

**"Connection refused"**

Check your internet connection and API URL. If you're self-hosting, make sure to use `--api-url` with your custom endpoint.

## Development

Want to build from source?

```bash
git clone https://github.com/keplog/keplog-cli.git
cd keplog-cli
npm install
npm run build
npm link
```

Run `npm run dev` for watch mode during development.

## License

MIT

## Links

- [Documentation](https://docs.keplog.io)
- [Report Issues](https://github.com/keplog/keplog-cli/issues)
- [Keplog Dashboard](https://keplog.io)
- [Support](mailto:support@keplog.io)
