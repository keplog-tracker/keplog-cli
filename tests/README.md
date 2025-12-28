# Keplog CLI Test Suite

Comprehensive unit tests for the official Keplog CLI.

## Test Overview

### Test Coverage

- **Total Tests**: 53 passing
- **Test Suites**: 2 (config.test.ts, uploader.test.ts)
- **Core Library Coverage**: 96%+
  - `lib/config.ts`: 97.43% coverage
  - `lib/uploader.ts`: 95.5% coverage

### Test Files

#### `config.test.ts` (31 tests)

Tests for the `ConfigManager` class that handles CLI configuration.

**Coverage Areas:**
- ✅ Local config file operations (.keplog.json)
- ✅ Global config file operations (~/.keplogrc)
- ✅ Config file discovery (walks up directory tree)
- ✅ Priority system (local > global > environment variables)
- ✅ Environment variable fallbacks
- ✅ Default values
- ✅ Error handling (malformed JSON, missing files)
- ✅ Edge cases (empty strings, partial configs)

**Key Test Scenarios:**
```typescript
// Config priority
ConfigManager.getConfig() // local > global > env vars

// Directory tree walking
project/
  ├── deep/
  │   └── nested/
  │       └── current-dir/    <- Finds .keplog.json from root
  └── .keplog.json

// Environment variable fallback
KEPLOG_PROJECT_ID=env-project  // Used when file config is empty
KEPLOG_API_KEY=env-key
```

#### `uploader.test.ts` (22 tests)

Tests for the `uploadSourceMaps` function that uploads source maps to Keplog API.

**Coverage Areas:**
- ✅ File discovery with glob patterns
- ✅ Nested directory traversal
- ✅ Multiple file patterns
- ✅ Duplicate file removal
- ✅ .map file filtering
- ✅ HTTP API communication
- ✅ Request headers and authentication
- ✅ Form data creation
- ✅ Error handling (401, 404, network errors, timeouts)
- ✅ Connection errors (ECONNREFUSED, ENOTFOUND)
- ✅ Verbose mode output
- ✅ Edge cases (large file sets, custom API URLs)

**Key Test Scenarios:**
```typescript
// Glob pattern matching
uploadSourceMaps({
  filePatterns: [
    'dist/**/*.map',      // Nested directories
    'build/*.map',        // Single directory
  ],
  // ... other options
});

// Error handling
- 401 Unauthorized (invalid API key)
- 404 Not Found (project doesn't exist)
- Network errors
- Timeout errors
- Connection refused
- DNS resolution failures
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Watch Mode (Re-run on Changes)
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Verbose Output
```bash
npm run test:verbose
```

## Test Structure

### ConfigManager Tests

```
ConfigManager
├── writeLocalConfig
│   ├── should write config to local .keplog.json file
│   ├── should format config file with proper indentation
│   └── should overwrite existing config
├── writeGlobalConfig
│   └── should write config to global ~/.keplogrc file
├── readConfig
│   ├── should read local config when it exists
│   ├── should read global config when local does not exist
│   ├── should prefer local config over global config
│   ├── should return empty object when no config exists
│   ├── should handle malformed JSON gracefully
│   └── should walk up directory tree to find local config
├── getConfig
│   ├── should merge file config with environment variables
│   ├── should prioritize file config over environment variables
│   ├── should use environment variables when file config is empty
│   ├── should use default API URL when not specified
│   ├── should override default API URL with environment variable
│   └── should override environment API URL with file config
├── hasLocalConfig / hasGlobalConfig
│   ├── should return true when config exists
│   └── should return false when config does not exist
├── getLocalConfigPath
│   ├── should return config path when it exists
│   ├── should return null when config does not exist
│   └── should return parent directory config path
├── deleteLocalConfig / deleteGlobalConfig
│   ├── should delete config file
│   └── should not throw when config does not exist
└── edge cases
    ├── should handle partial config objects
    ├── should handle config with only optional fields
    └── should handle empty string values
```

### Uploader Tests

```
uploadSourceMaps
├── file discovery
│   ├── should find source map files matching pattern
│   ├── should find nested source map files with glob pattern
│   ├── should handle multiple file patterns
│   ├── should remove duplicate files from multiple patterns
│   ├── should exit with error when no files found
│   └── should filter out non-.map files
├── API communication
│   ├── should send correct API request
│   ├── should include release in form data
│   ├── should handle successful upload
│   └── should exit with error when upload has errors
├── error handling
│   ├── should handle 401 authentication error
│   ├── should handle 404 project not found
│   ├── should handle network errors
│   ├── should handle timeout errors
│   ├── should handle server connection errors
│   └── should handle DNS resolution errors
├── verbose mode
│   ├── should display detailed information in verbose mode
│   └── should not display extra information when verbose is false
└── edge cases
    ├── should handle empty release string
    ├── should handle very large number of files
    └── should handle custom API URL
```

## Testing Approach

### Unit Testing Strategy

1. **Isolation**: Each test runs in a temporary directory with clean state
2. **Mocking**: External dependencies (axios, process.exit) are mocked
3. **Coverage**: Aim for >95% code coverage on core modules
4. **Edge Cases**: Test boundary conditions and error paths
5. **Real Scenarios**: Test actual use cases developers will encounter

### Test Setup/Teardown

```typescript
beforeEach(() => {
  // Create temporary test directory
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keplog-test-'));

  // Save original state
  originalCwd = process.cwd();
  originalEnv = { ...process.env };

  // Clean environment
  process.chdir(testDir);
  delete process.env.KEPLOG_PROJECT_ID;
  delete process.env.KEPLOG_API_KEY;
});

afterEach(() => {
  // Restore original state
  process.chdir(originalCwd);
  process.env = originalEnv;

  // Clean up test files
  fs.rmSync(testDir, { recursive: true, force: true });
});
```

### Mocking Strategy

#### Axios Mocking
```typescript
import MockAdapter from 'axios-mock-adapter';

const mock = new MockAdapter(axios);

// Mock successful response
mock.onPost('/api/endpoint').reply(200, { data: 'response' });

// Mock error
mock.onPost('/api/endpoint').reply(404, { error: 'Not found' });

// Mock network error
mock.onPost('/api/endpoint').networkError();
```

#### Process Exit Mocking
```typescript
process.exit = jest.fn() as any;

// Test that exit was called
expect(process.exit).toHaveBeenCalledWith(1);
```

#### Console Output Suppression
```typescript
jest.spyOn(console, 'log').mockImplementation();
jest.spyOn(console, 'error').mockImplementation();
```

## Future Test Additions

### Planned Enhancements

1. **Integration Tests**
   - End-to-end CLI command testing
   - Test actual command execution
   - Verify command-line argument parsing

2. **Command Tests**
   - `keplog init` - Interactive configuration setup
   - `keplog upload` - Source map upload workflow
   - `keplog list` - List releases
   - `keplog delete` - Delete releases
   - `keplog releases` - Manage releases

3. **Error Recovery Tests**
   - Partial upload failures
   - Network interruption recovery
   - Invalid configuration recovery

4. **Performance Tests**
   - Large file upload performance
   - Many files (1000+) handling
   - Memory usage profiling

## Continuous Integration

### Running Tests in CI

```yaml
# GitHub Actions example
- name: Run tests
  run: npm test

- name: Generate coverage report
  run: npm run test:coverage

- name: Upload coverage to Codecov
  uses: codecov/codecov-action@v3
```

### Test Quality Gates

- **Minimum Coverage**: 90% for core library modules
- **All Tests Must Pass**: No failing tests allowed in CI
- **No console warnings**: Tests should run cleanly

## Troubleshooting

### Common Issues

**Issue**: Tests fail with "Cannot find module"
```bash
# Solution: Rebuild TypeScript
npm run build
```

**Issue**: Permission errors on ~/.keplogrc
```bash
# Solution: Clean up global config before tests
rm ~/.keplogrc
```

**Issue**: Tests timeout
```bash
# Solution: Increase Jest timeout in jest.config.js
testTimeout: 30000  // 30 seconds
```

**Issue**: Path differences on macOS (/var vs /private/var)
```typescript
// Solution: Use fs.realpathSync() for path comparisons
const expectedPath = fs.realpathSync(path.join(testDir, '.keplog.json'));
```

## Contributing Tests

### Adding New Tests

1. Create test file in `tests/` directory
2. Import module under test
3. Write describe/it blocks
4. Ensure proper setup/teardown
5. Run tests: `npm test`
6. Check coverage: `npm run test:coverage`

### Test Naming Conventions

```typescript
describe('ClassName or functionName', () => {
  describe('methodName or scenario', () => {
    it('should do something specific', () => {
      // Test implementation
    });
  });
});
```

### Test Best Practices

✅ **DO**:
- Write descriptive test names
- Test one thing per test
- Use beforeEach/afterEach for setup/cleanup
- Mock external dependencies
- Test edge cases and error paths
- Keep tests fast (<100ms per test)

❌ **DON'T**:
- Test implementation details
- Share state between tests
- Use real network requests
- Hardcode file paths
- Skip cleanup

## Test Metrics

Current Status (as of latest run):
- ✅ 53 tests passing
- ✅ 0 tests failing
- ✅ 96% average coverage on core modules
- ⏱️  ~1s total test execution time

---

**Test Suite Maintained By**: Keplog Team
**Last Updated**: December 2024
**Jest Version**: 30.2.0
**TypeScript Version**: 5.3.3
