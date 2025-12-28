import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ConfigManager, KeplogConfig } from '../src/lib/config';

describe('ConfigManager', () => {
  let testDir: string;
  let originalCwd: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create a temporary test directory
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keplog-test-'));
    originalCwd = process.cwd();
    originalEnv = { ...process.env };

    // Change to test directory
    process.chdir(testDir);

    // Clear environment variables
    delete process.env.KEPLOG_PROJECT_ID;
    delete process.env.KEPLOG_API_KEY;
    delete process.env.KEPLOG_API_URL;
  });

  afterEach(() => {
    // Restore original state
    process.chdir(originalCwd);
    process.env = originalEnv;

    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }

    // Clean up global config if created during tests
    const globalConfig = path.join(os.homedir(), '.keplogrc');
    if (fs.existsSync(globalConfig)) {
      fs.unlinkSync(globalConfig);
    }
  });

  describe('writeLocalConfig', () => {
    it('should write config to local .keplog.json file', () => {
      const config: KeplogConfig = {
        projectId: 'test-project-id',
        apiKey: 'test-api-key',
        apiUrl: 'https://api.keplog.com',
        projectName: 'Test Project',
      };

      ConfigManager.writeLocalConfig(config, testDir);

      const configPath = path.join(testDir, '.keplog.json');
      expect(fs.existsSync(configPath)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      expect(savedConfig).toEqual(config);
    });

    it('should format config file with proper indentation', () => {
      const config: KeplogConfig = {
        projectId: 'test-project-id',
        apiKey: 'test-api-key',
      };

      ConfigManager.writeLocalConfig(config, testDir);

      const content = fs.readFileSync(path.join(testDir, '.keplog.json'), 'utf-8');
      expect(content).toContain('  '); // Should have 2-space indentation
      expect(content.split('\n').length).toBeGreaterThan(1); // Should be multi-line
    });

    it('should overwrite existing config', () => {
      const firstConfig: KeplogConfig = { projectId: 'first', apiKey: 'key1' };
      const secondConfig: KeplogConfig = { projectId: 'second', apiKey: 'key2' };

      ConfigManager.writeLocalConfig(firstConfig, testDir);
      ConfigManager.writeLocalConfig(secondConfig, testDir);

      const savedConfig = JSON.parse(
        fs.readFileSync(path.join(testDir, '.keplog.json'), 'utf-8')
      );
      expect(savedConfig).toEqual(secondConfig);
    });
  });

  describe('writeGlobalConfig', () => {
    it('should write config to global ~/.keplogrc file', () => {
      const config: KeplogConfig = {
        projectId: 'global-project-id',
        apiKey: 'global-api-key',
      };

      ConfigManager.writeGlobalConfig(config);

      const globalConfigPath = path.join(os.homedir(), '.keplogrc');
      expect(fs.existsSync(globalConfigPath)).toBe(true);

      const savedConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf-8'));
      expect(savedConfig).toEqual(config);
    });
  });

  describe('readConfig', () => {
    it('should read local config when it exists', () => {
      const config: KeplogConfig = {
        projectId: 'local-project',
        apiKey: 'local-key',
      };

      ConfigManager.writeLocalConfig(config, testDir);
      const readConfig = ConfigManager.readConfig();

      expect(readConfig).toEqual(config);
    });

    it('should read global config when local does not exist', () => {
      const config: KeplogConfig = {
        projectId: 'global-project',
        apiKey: 'global-key',
      };

      ConfigManager.writeGlobalConfig(config);
      const readConfig = ConfigManager.readConfig();

      expect(readConfig).toEqual(config);
    });

    it('should prefer local config over global config', () => {
      const localConfig: KeplogConfig = {
        projectId: 'local-project',
        apiKey: 'local-key',
      };
      const globalConfig: KeplogConfig = {
        projectId: 'global-project',
        apiKey: 'global-key',
      };

      ConfigManager.writeGlobalConfig(globalConfig);
      ConfigManager.writeLocalConfig(localConfig, testDir);

      const readConfig = ConfigManager.readConfig();
      expect(readConfig).toEqual(localConfig);
    });

    it('should return empty object when no config exists', () => {
      const readConfig = ConfigManager.readConfig();
      expect(readConfig).toEqual({});
    });

    it('should handle malformed JSON gracefully', () => {
      const configPath = path.join(testDir, '.keplog.json');
      fs.writeFileSync(configPath, 'invalid json{', 'utf-8');

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const readConfig = ConfigManager.readConfig();

      expect(readConfig).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should walk up directory tree to find local config', () => {
      // Create nested directory structure
      const nestedDir = path.join(testDir, 'a', 'b', 'c');
      fs.mkdirSync(nestedDir, { recursive: true });

      // Write config in root test dir
      const config: KeplogConfig = { projectId: 'root-project', apiKey: 'root-key' };
      ConfigManager.writeLocalConfig(config, testDir);

      // Change to nested directory
      process.chdir(nestedDir);

      // Should find config from parent directory
      const readConfig = ConfigManager.readConfig();
      expect(readConfig).toEqual(config);
    });
  });

  describe('getConfig', () => {
    it('should merge file config with environment variables', () => {
      const fileConfig: KeplogConfig = {
        projectId: 'file-project',
        projectName: 'File Project',
      };

      ConfigManager.writeLocalConfig(fileConfig, testDir);

      process.env.KEPLOG_API_KEY = 'env-api-key';
      process.env.KEPLOG_API_URL = 'https://env-api.keplog.com';

      const config = ConfigManager.getConfig();

      expect(config.projectId).toBe('file-project');
      expect(config.apiKey).toBe('env-api-key');
      expect(config.apiUrl).toBe('https://env-api.keplog.com');
      expect(config.projectName).toBe('File Project');
    });

    it('should prioritize file config over environment variables', () => {
      const fileConfig: KeplogConfig = {
        projectId: 'file-project',
        apiKey: 'file-api-key',
      };

      ConfigManager.writeLocalConfig(fileConfig, testDir);

      process.env.KEPLOG_PROJECT_ID = 'env-project';
      process.env.KEPLOG_API_KEY = 'env-api-key';

      const config = ConfigManager.getConfig();

      expect(config.projectId).toBe('file-project');
      expect(config.apiKey).toBe('file-api-key');
    });

    it('should use environment variables when file config is empty', () => {
      process.env.KEPLOG_PROJECT_ID = 'env-project';
      process.env.KEPLOG_API_KEY = 'env-api-key';
      process.env.KEPLOG_API_URL = 'https://env-api.keplog.com';

      const config = ConfigManager.getConfig();

      expect(config.projectId).toBe('env-project');
      expect(config.apiKey).toBe('env-api-key');
      expect(config.apiUrl).toBe('https://env-api.keplog.com');
    });

    it('should use default API URL when not specified', () => {
      const config = ConfigManager.getConfig();
      expect(config.apiUrl).toBe('https://api.keplog.com');
    });

    it('should override default API URL with environment variable', () => {
      process.env.KEPLOG_API_URL = 'https://custom.keplog.com';
      const config = ConfigManager.getConfig();
      expect(config.apiUrl).toBe('https://custom.keplog.com');
    });

    it('should override environment API URL with file config', () => {
      process.env.KEPLOG_API_URL = 'https://env.keplog.com';
      const fileConfig: KeplogConfig = {
        apiUrl: 'https://file.keplog.com',
      };
      ConfigManager.writeLocalConfig(fileConfig, testDir);

      const config = ConfigManager.getConfig();
      expect(config.apiUrl).toBe('https://file.keplog.com');
    });
  });

  describe('hasLocalConfig', () => {
    it('should return true when local config exists', () => {
      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeLocalConfig(config, testDir);

      expect(ConfigManager.hasLocalConfig()).toBe(true);
    });

    it('should return false when local config does not exist', () => {
      expect(ConfigManager.hasLocalConfig()).toBe(false);
    });

    it('should return true when config exists in parent directory', () => {
      const nestedDir = path.join(testDir, 'nested');
      fs.mkdirSync(nestedDir);

      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeLocalConfig(config, testDir);

      process.chdir(nestedDir);
      expect(ConfigManager.hasLocalConfig()).toBe(true);
    });
  });

  describe('hasGlobalConfig', () => {
    it('should return true when global config exists', () => {
      const config: KeplogConfig = { projectId: 'global', apiKey: 'key' };
      ConfigManager.writeGlobalConfig(config);

      expect(ConfigManager.hasGlobalConfig()).toBe(true);
    });

    it('should return false when global config does not exist', () => {
      expect(ConfigManager.hasGlobalConfig()).toBe(false);
    });
  });

  describe('getLocalConfigPath', () => {
    it('should return config path when it exists', () => {
      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeLocalConfig(config, testDir);

      const configPath = ConfigManager.getLocalConfigPath();
      const expectedPath = fs.realpathSync(path.join(testDir, '.keplog.json'));
      expect(configPath).toBe(expectedPath);
    });

    it('should return null when config does not exist', () => {
      const configPath = ConfigManager.getLocalConfigPath();
      expect(configPath).toBeNull();
    });

    it('should return parent directory config path', () => {
      const nestedDir = path.join(testDir, 'a', 'b');
      fs.mkdirSync(nestedDir, { recursive: true });

      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeLocalConfig(config, testDir);

      process.chdir(nestedDir);
      const configPath = ConfigManager.getLocalConfigPath();
      const expectedPath = fs.realpathSync(path.join(testDir, '.keplog.json'));
      expect(configPath).toBe(expectedPath);
    });
  });

  describe('deleteLocalConfig', () => {
    it('should delete local config file', () => {
      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeLocalConfig(config, testDir);

      const configPath = path.join(testDir, '.keplog.json');
      expect(fs.existsSync(configPath)).toBe(true);

      ConfigManager.deleteLocalConfig(testDir);
      expect(fs.existsSync(configPath)).toBe(false);
    });

    it('should not throw when config does not exist', () => {
      expect(() => ConfigManager.deleteLocalConfig(testDir)).not.toThrow();
    });
  });

  describe('deleteGlobalConfig', () => {
    it('should delete global config file', () => {
      const config: KeplogConfig = { projectId: 'test', apiKey: 'key' };
      ConfigManager.writeGlobalConfig(config);

      const globalPath = path.join(os.homedir(), '.keplogrc');
      expect(fs.existsSync(globalPath)).toBe(true);

      ConfigManager.deleteGlobalConfig();
      expect(fs.existsSync(globalPath)).toBe(false);
    });

    it('should not throw when global config does not exist', () => {
      expect(() => ConfigManager.deleteGlobalConfig()).not.toThrow();
    });
  });

  describe('edge cases', () => {
    it('should handle partial config objects', () => {
      const partialConfig: KeplogConfig = {
        projectId: 'test-id',
        // apiKey is missing
      };

      ConfigManager.writeLocalConfig(partialConfig, testDir);
      const readConfig = ConfigManager.readConfig();

      expect(readConfig.projectId).toBe('test-id');
      expect(readConfig.apiKey).toBeUndefined();
    });

    it('should handle config with only optional fields', () => {
      const config: KeplogConfig = {
        projectName: 'Optional Name',
      };

      ConfigManager.writeLocalConfig(config, testDir);
      const fullConfig = ConfigManager.getConfig();

      expect(fullConfig.projectName).toBe('Optional Name');
      expect(fullConfig.apiUrl).toBe('https://api.keplog.com'); // Default
    });

    it('should handle empty string values', () => {
      const config: KeplogConfig = {
        projectId: '',
        apiKey: '',
      };

      ConfigManager.writeLocalConfig(config, testDir);
      process.env.KEPLOG_PROJECT_ID = 'env-id';
      process.env.KEPLOG_API_KEY = 'env-key';

      const fullConfig = ConfigManager.getConfig();

      // Empty strings are falsy, so env vars should be used
      expect(fullConfig.projectId).toBe('env-id');
      expect(fullConfig.apiKey).toBe('env-key');
    });
  });
});
