import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { uploadSourceMaps } from '../src/lib/uploader';

// Mock ora to avoid spinner output during tests
jest.mock('ora', () => {
  return jest.fn(() => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
    info: jest.fn().mockReturnThis(),
  }));
});

describe('uploadSourceMaps', () => {
  let mock: MockAdapter;
  let testDir: string;
  let originalProcessExit: any;

  beforeEach(() => {
    // Create axios mock
    mock = new MockAdapter(axios);

    // Create temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keplog-upload-test-'));

    // Mock process.exit to prevent tests from actually exiting
    originalProcessExit = process.exit;
    process.exit = jest.fn() as any;

    // Suppress console output during tests
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    // Restore mocks
    mock.restore();
    process.exit = originalProcessExit;

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Restore console
    jest.restoreAllMocks();
  });

  describe('file discovery', () => {
    it('should find source map files matching pattern', async () => {
      // Create test .map files
      const mapFiles = ['app.js.map', 'vendor.js.map', 'style.css.map'];
      mapFiles.forEach(file => {
        fs.writeFileSync(path.join(testDir, file), '{}', 'utf-8');
      });

      // Mock successful upload
      mock.onPost().reply(200, {
        uploaded: mapFiles,
        errors: [],
        release: 'v1.0.0',
        count: mapFiles.length,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      // Should have called the API
      expect(mock.history.post.length).toBe(1);
    });

    it('should find nested source map files with glob pattern', async () => {
      // Create nested directory structure
      const nestedDir = path.join(testDir, 'dist', 'js');
      fs.mkdirSync(nestedDir, { recursive: true });

      fs.writeFileSync(path.join(nestedDir, 'app.js.map'), '{}', 'utf-8');
      fs.writeFileSync(path.join(testDir, 'dist', 'style.css.map'), '{}', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map', 'style.css.map'],
        errors: [],
        release: 'v1.0.0',
        count: 2,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '**/*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });

    it('should handle multiple file patterns', async () => {
      // Create files in different directories
      fs.mkdirSync(path.join(testDir, 'dist'), { recursive: true });
      fs.mkdirSync(path.join(testDir, 'build'), { recursive: true });

      fs.writeFileSync(path.join(testDir, 'dist', 'app.js.map'), '{}', 'utf-8');
      fs.writeFileSync(path.join(testDir, 'build', 'vendor.js.map'), '{}', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map', 'vendor.js.map'],
        errors: [],
        release: 'v1.0.0',
        count: 2,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [
          path.join(testDir, 'dist/*.map'),
          path.join(testDir, 'build/*.map'),
        ],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });

    it('should remove duplicate files from multiple patterns', async () => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map'],
        errors: [],
        release: 'v1.0.0',
        count: 1,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        // Same file matched by two patterns
        filePatterns: [
          path.join(testDir, '*.map'),
          path.join(testDir, 'app.js.map'),
        ],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      // Should only upload once
      expect(mock.history.post.length).toBe(1);
    });

    it('should exit with error when no files found', async () => {
      try {
        await uploadSourceMaps({
          release: 'v1.0.0',
          filePatterns: [path.join(testDir, '*.map')],
          projectId: 'test-project',
          apiKey: 'test-key',
          apiUrl: 'https://api.keplog.com',
          verbose: false,
        });
      } catch (error) {
        // May throw or exit
      }

      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should filter out non-.map files', async () => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');
      fs.writeFileSync(path.join(testDir, 'app.js'), 'code', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map'],
        errors: [],
        release: 'v1.0.0',
        count: 1,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });
  });

  describe('API communication', () => {
    beforeEach(() => {
      // Create a test .map file for upload tests
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{"version":3}', 'utf-8');
    });

    it('should send correct API request', async () => {
      mock.onPost().reply(config => {
        // Verify URL and headers
        expect(config.url).toContain('/api/v1/cli/projects/test-project/sourcemaps');
        expect(config.headers?.['X-API-Key']).toBe('test-api-key');

        return [200, {
          uploaded: ['app.js.map'],
          errors: [],
          release: 'v1.0.0',
          count: 1,
        }];
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-api-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });

    it('should include release in form data', async () => {
      mock.onPost().reply(200, {
        uploaded: ['app.js.map'],
        errors: [],
        release: 'v2.0.0',
        count: 1,
      });

      await uploadSourceMaps({
        release: 'v2.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      // Verify request was made
      expect(mock.history.post.length).toBe(1);
    });

    it('should handle successful upload', async () => {
      mock.onPost().reply(200, {
        uploaded: ['app.js.map'],
        errors: [],
        release: 'v1.0.0',
        count: 1,
      });

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).resolves.not.toThrow();
    });

    it('should exit with error when upload has errors', async () => {
      mock.onPost().reply(200, {
        uploaded: [],
        errors: ['File too large', 'Invalid format'],
        release: 'v1.0.0',
        count: 0,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');
    });

    it('should handle 401 authentication error', async () => {
      mock.onPost().reply(401, {
        error: 'Invalid API key',
      });

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'invalid-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow('Invalid API key');
    });

    it('should handle 404 project not found', async () => {
      mock.onPost().reply(404, {
        error: 'Project not found',
      });

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'nonexistent',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow('Project not found');
    });

    it('should handle network errors', async () => {
      mock.onPost().networkError();

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow();
    });

    it('should handle timeout errors', async () => {
      mock.onPost().timeout();

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow();
    });

    it('should handle server connection errors', async () => {
      mock.onPost().reply(() => {
        const error: any = new Error('connect ECONNREFUSED');
        error.code = 'ECONNREFUSED';
        error.isAxiosError = true;
        throw error;
      });

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow();
    });

    it('should handle DNS resolution errors', async () => {
      mock.onPost().reply(() => {
        const error: any = new Error('getaddrinfo ENOTFOUND');
        error.code = 'ENOTFOUND';
        error.isAxiosError = true;
        throw error;
      });

      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://invalid-domain.keplog.com',
        verbose: false,
      })).rejects.toThrow();
    });

    it('should handle invalid glob patterns', async () => {
      await expect(uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: ['[invalid-pattern'],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      })).rejects.toThrow();
    });
  });

  describe('verbose mode', () => {
    beforeEach(() => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');
      fs.writeFileSync(path.join(testDir, 'vendor.js.map'), '{}', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map', 'vendor.js.map'],
        errors: [],
        release: 'v1.0.0',
        count: 2,
      });
    });

    it('should display detailed information in verbose mode', async () => {
      const consoleSpy = jest.spyOn(console, 'log');

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: true,
      });

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not display extra information when verbose is false', async () => {
      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      // Should still complete successfully
      expect(mock.history.post.length).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty release string', async () => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');

      mock.onPost().reply(200, {
        uploaded: ['app.js.map'],
        errors: [],
        release: '',
        count: 1,
      });

      await uploadSourceMaps({
        release: '',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });

    it('should handle very large number of files', async () => {
      // Create 100 test files
      for (let i = 0; i < 100; i++) {
        fs.writeFileSync(path.join(testDir, `file${i}.js.map`), '{}', 'utf-8');
      }

      const files = Array.from({ length: 100 }, (_, i) => `file${i}.js.map`);
      mock.onPost().reply(200, {
        uploaded: files,
        errors: [],
        release: 'v1.0.0',
        count: 100,
      });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://api.keplog.com',
        verbose: false,
      });

      expect(mock.history.post.length).toBe(1);
    });

    it('should handle custom API URL', async () => {
      fs.writeFileSync(path.join(testDir, 'app.js.map'), '{}', 'utf-8');

      mock.onPost('https://custom.keplog.io/api/v1/cli/projects/test-project/sourcemaps')
        .reply(200, {
          uploaded: ['app.js.map'],
          errors: [],
          release: 'v1.0.0',
          count: 1,
        });

      await uploadSourceMaps({
        release: 'v1.0.0',
        filePatterns: [path.join(testDir, '*.map')],
        projectId: 'test-project',
        apiKey: 'test-key',
        apiUrl: 'https://custom.keplog.io',
        verbose: false,
      });

      expect(mock.history.post[0].url).toContain('custom.keplog.io');
    });
  });
});
