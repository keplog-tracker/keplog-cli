# Keplog CLI

Official command-line interface for [Keplog](https://keplog.com) - Error tracking and monitoring platform.

## Features

- ⚡ **Interactive Setup** - Run `keplog init` to configure in seconds
- 📦 **Source Map Upload** - Upload source maps for error stack trace transformation
- 🔐 **Secure Configuration** - Local `.keplog.json` or global `~/.keplogrc` support
- 📁 **Glob Patterns** - Flexible file matching with glob support
- 🎨 **Beautiful Output** - Progress indicators and colored terminal output
- 🚀 **Fast & Efficient** - Optimized upload performance

## Installation

### Global Installation (Recommended)

```bash
npm install -g @keplog/cli
```

### Local Installation

```bash
npm install --save-dev @keplog/cli
```

### Using npx (No installation required)

```bash
npx @keplog/cli upload --release=v1.0.0 --files="dist/**/*.map"
```

## Quick Start

### 1. Initialize Configuration (Recommended)

Run the interactive setup wizard:

```bash
keplog init
```

This will prompt you for:
- Project ID
- API Key
- API URL (optional)
- Project name (optional)

Your credentials will be saved to `.keplog.json` in the current directory.

**Alternative:** Use global configuration with `keplog init --global` to save to `~/.keplogrc`.

### 2. Upload Source Maps

```bash
keplog upload --release=v1.0.0 --files="dist/**/*.map"
```

The CLI will automatically use credentials from `.keplog.json` or `~/.keplogrc`.

## Commands

### Init Command

Initialize Keplog configuration for your project interactively.

```bash
keplog init [options]
```

#### Options

| Option | Alias | Description |
|--------|-------|-------------|
| `--global` | `-g` | Save configuration globally (in ~/.keplogrc) |
| `--force` | `-f` | Overwrite existing configuration |

#### Examples

**Local configuration (project-specific):**

```bash
keplog init
```

Creates `.keplog.json` in the current directory.

**Global configuration (user-level):**

```bash
keplog init --global
```

Creates `~/.keplogrc` in your home directory.

**Force overwrite:**

```bash
keplog init --force
```

#### Configuration Priority

The CLI loads configuration in this order (first wins):

1. Command-line flags (`--project-id`, `--api-key`)
2. Local `.keplog.json` (in current directory or parent directories)
3. Global `~/.keplogrc` (in home directory)
4. Environment variables (`KEPLOG_PROJECT_ID`, `KEPLOG_API_KEY`)

### Upload Command

Upload source maps for a specific release version.

```bash
keplog upload [options]
```

#### Options

| Option | Alias | Description | Required | Default |
|--------|-------|-------------|----------|---------|
| `--release <version>` | `-r` | Release version (e.g., v1.0.0) | ✅ Yes | - |
| `--files <patterns...>` | `-f` | Source map file patterns (glob) | ✅ Yes | - |
| `--project-id <id>` | `-p` | Project ID | ✅ Yes* | `KEPLOG_PROJECT_ID` |
| `--api-key <key>` | `-k` | API Key | ✅ Yes* | `KEPLOG_API_KEY` |
| `--api-url <url>` | `-u` | API URL | ❌ No | `https://api.keplog.com` |
| `--verbose` | `-v` | Verbose output | ❌ No | `false` |

\* Required, but can be provided via environment variables

#### Examples

**Basic upload:**

```bash
keplog upload --release=v1.0.0 --files="dist/**/*.map"
```

**Multiple file patterns:**

```bash
keplog upload \
  --release=v1.0.0 \
  --files="dist/js/**/*.map" \
  --files="dist/css/**/*.map"
```

**With explicit credentials:**

```bash
keplog upload \
  --release=v1.0.0 \
  --files="build/**/*.map" \
  --project-id="abc-123-def-456" \
  --api-key="proj_xyz789"
```

**Verbose output:**

```bash
keplog upload \
  --release=v1.0.0 \
  --files="*.map" \
  --verbose
```

**Custom API URL (self-hosted):**

```bash
keplog upload \
  --release=v1.0.0 \
  --files="*.map" \
  --api-url="https://keplog.yourcompany.com"
```

## CI/CD Integration

### GitHub Actions

```yaml
name: Deploy with Source Maps

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Application
        run: npm run build

      - name: Upload Source Maps
        run: npx @keplog/cli upload --release=${{ github.ref_name }} --files="dist/**/*.map"
        env:
          KEPLOG_PROJECT_ID: ${{ secrets.KEPLOG_PROJECT_ID }}
          KEPLOG_API_KEY: ${{ secrets.KEPLOG_API_KEY }}

      - name: Deploy
        run: npm run deploy
```

### GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - npm run build
    - npx @keplog/cli upload --release=${CI_COMMIT_TAG} --files="dist/**/*.map"
    - npm run deploy
  variables:
    KEPLOG_PROJECT_ID: $KEPLOG_PROJECT_ID
    KEPLOG_API_KEY: $KEPLOG_API_KEY
  only:
    - tags
```

### CircleCI

```yaml
version: 2.1

jobs:
  deploy:
    docker:
      - image: node:18
    steps:
      - checkout
      - run:
          name: Build
          command: npm run build
      - run:
          name: Upload Source Maps
          command: npx @keplog/cli upload --release=${CIRCLE_TAG} --files="dist/**/*.map"
      - run:
          name: Deploy
          command: npm run deploy

workflows:
  deploy:
    jobs:
      - deploy:
          filters:
            tags:
              only: /^v.*/
            branches:
              ignore: /.*/
```

### Jenkins

```groovy
pipeline {
    agent any

    environment {
        KEPLOG_PROJECT_ID = credentials('keplog-project-id')
        KEPLOG_API_KEY = credentials('keplog-api-key')
    }

    stages {
        stage('Build') {
            steps {
                sh 'npm run build'
            }
        }

        stage('Upload Source Maps') {
            steps {
                sh 'npx @keplog/cli upload --release=${GIT_TAG} --files="dist/**/*.map"'
            }
        }

        stage('Deploy') {
            steps {
                sh 'npm run deploy'
            }
        }
    }
}
```

## npm Scripts Integration

Add to your `package.json`:

```json
{
  "scripts": {
    "build": "webpack --mode production",
    "upload-sourcemaps": "keplog upload --release=$npm_package_version --files='dist/**/*.map'",
    "deploy": "npm run build && npm run upload-sourcemaps && npm run deploy-to-prod"
  }
}
```

Then run:

```bash
npm run deploy
```

## Environment Variables

The CLI supports the following environment variables:

| Variable | Description |
|----------|-------------|
| `KEPLOG_PROJECT_ID` | Your Keplog project ID |
| `KEPLOG_API_KEY` | Your Keplog API key |
| `KEPLOG_API_URL` | Custom API URL (optional) |
| `DEBUG` | Enable debug output (shows stack traces) |

Create a `.env` file in your project root:

```env
KEPLOG_PROJECT_ID=abc-123-def-456
KEPLOG_API_KEY=proj_xyz789
```

## Getting Your Credentials

### Project ID and API Key

1. Go to your project settings in Keplog dashboard
2. Navigate to **Settings → General**
3. Find the **Project Credentials** section
4. Copy your **Project ID** and **API Key**

## Glob Patterns

The `--files` option supports glob patterns for flexible file matching:

| Pattern | Description | Example |
|---------|-------------|---------|
| `*.map` | All .map files in current directory | `bundle.js.map` |
| `**/*.map` | All .map files recursively | `dist/js/bundle.js.map` |
| `dist/**/*.map` | All .map files in dist/ | `dist/assets/main.js.map` |
| `{js,css}/**/*.map` | .map files in js/ and css/ | `js/app.js.map` |

## Best Practices

### 1. Use Semantic Versioning

Always use semantic versioning for your releases:

```bash
keplog upload --release=v1.2.3 --files="dist/**/*.map"
```

### 2. Match Release with Error Tags

Ensure your application sends the same release version:

```javascript
keplog.init({
  apiKey: 'your-api-key',
  release: 'v1.2.3'  // Must match uploaded source maps
});
```

### 3. Don't Deploy Source Maps

Never deploy `.map` files to production. Upload them to Keplog, then exclude from deployment:

```bash
# Upload to Keplog
keplog upload --release=v1.0.0 --files="dist/**/*.map"

# Remove from deployment
rm dist/**/*.map

# Then deploy
npm run deploy
```

### 4. Automate in CI/CD

Integrate source map uploads into your CI/CD pipeline for automatic uploads on every release.

### 5. Use Environment Variables

Store credentials as environment variables or secrets, never commit them to git:

```bash
# ✅ Good
export KEPLOG_API_KEY="proj_xyz789"
keplog upload --release=v1.0.0 --files="*.map"

# ❌ Bad
keplog upload --release=v1.0.0 --files="*.map" --api-key="proj_xyz789"  # Visible in history
```

## Troubleshooting

### Error: "Source map integration not configured"

**Solution**: Configure the S3/GCS storage plugin in your Keplog project settings first.

1. Go to Project Settings → Plugins
2. Enable a source map storage plugin (S3, GCS, or HTTP)
3. Configure your storage credentials

### Error: "Project ID mismatch"

**Solution**: Ensure your API key matches the project ID:

```bash
# Wrong
keplog upload --project-id=project-A --api-key=key-for-project-B

# Correct
keplog upload --project-id=project-A --api-key=key-for-project-A
```

### Error: "No files matched the patterns"

**Solution**: Check your glob patterns:

```bash
# See what files exist
ls -la dist/**/*.map

# Adjust your pattern
keplog upload --release=v1.0.0 --files="dist/static/**/*.map"
```

### Error: "Connection refused"

**Solution**: Check your API URL and internet connection:

```bash
# Test connection
curl https://api.keplog.com/health

# Use custom URL if self-hosted
keplog upload --api-url="https://keplog.yourcompany.com" ...
```

## Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/keplog/keplog-cli.git
cd keplog-cli

# Install dependencies
npm install

# Build
npm run build

# Link locally
npm link

# Test
keplog upload --help
```

### Watch Mode

```bash
npm run dev
```

## Support

- 📧 Email: support@keplog.com
- 📚 Documentation: https://docs.keplog.com
- 🐛 Issues: https://github.com/keplog/keplog-cli/issues
- 💬 Discord: https://discord.gg/keplog

## License

MIT © Keplog Team

## Changelog

### v1.0.0 (2025-01-15)

- ✨ Initial release
- 📦 Source map upload functionality
- 🎨 Beautiful CLI interface with progress indicators
- 📁 Glob pattern support
- 🔐 API key authentication
- 📝 Comprehensive documentation
