import * as fs from 'fs';
import * as path from 'path';
import { homedir } from 'os';

export interface KeplogConfig {
  projectId?: string;
  apiKey?: string;
  apiUrl?: string;
  projectName?: string;
}

const CONFIG_FILENAME = '.keplog.json';
const GLOBAL_CONFIG_PATH = path.join(homedir(), '.keplogrc');

/**
 * Config Manager for Keplog CLI
 *
 * Priority order:
 * 1. Local .keplog.json (project-specific)
 * 2. Global ~/.keplogrc (user-level)
 * 3. Environment variables (KEPLOG_PROJECT_ID, KEPLOG_API_KEY)
 */
export class ConfigManager {
  /**
   * Find the nearest .keplog.json file by walking up the directory tree
   */
  private static findLocalConfigPath(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;
    const root = path.parse(currentDir).root;

    while (currentDir !== root) {
      const configPath = path.join(currentDir, CONFIG_FILENAME);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  /**
   * Read configuration from local or global config file
   */
  static readConfig(): KeplogConfig {
    // Try local config first
    const localConfigPath = this.findLocalConfigPath();
    if (localConfigPath) {
      try {
        const content = fs.readFileSync(localConfigPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Warning: Failed to read config from ${localConfigPath}`);
      }
    }

    // Try global config
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
      try {
        const content = fs.readFileSync(GLOBAL_CONFIG_PATH, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.warn(`Warning: Failed to read global config from ${GLOBAL_CONFIG_PATH}`);
      }
    }

    return {};
  }

  /**
   * Write configuration to local .keplog.json file
   */
  static writeLocalConfig(config: KeplogConfig, dir: string = process.cwd()): void {
    const configPath = path.join(dir, CONFIG_FILENAME);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Write configuration to global ~/.keplogrc file
   */
  static writeGlobalConfig(config: KeplogConfig): void {
    fs.writeFileSync(GLOBAL_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  }

  /**
   * Get configuration with priority: local > global > env vars
   */
  static getConfig(): KeplogConfig {
    const fileConfig = this.readConfig();

    return {
      projectId: fileConfig.projectId || process.env.KEPLOG_PROJECT_ID,
      apiKey: fileConfig.apiKey || process.env.KEPLOG_API_KEY,
      apiUrl: fileConfig.apiUrl || process.env.KEPLOG_API_URL || 'https://api.keplog.io',
      projectName: fileConfig.projectName,
    };
  }

  /**
   * Check if local config exists in current directory or parent directories
   */
  static hasLocalConfig(): boolean {
    return this.findLocalConfigPath() !== null;
  }

  /**
   * Check if global config exists
   */
  static hasGlobalConfig(): boolean {
    return fs.existsSync(GLOBAL_CONFIG_PATH);
  }

  /**
   * Get the path of the local config file (if it exists)
   */
  static getLocalConfigPath(): string | null {
    return this.findLocalConfigPath();
  }

  /**
   * Delete local config
   */
  static deleteLocalConfig(dir: string = process.cwd()): void {
    const configPath = path.join(dir, CONFIG_FILENAME);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
  }

  /**
   * Delete global config
   */
  static deleteGlobalConfig(): void {
    if (fs.existsSync(GLOBAL_CONFIG_PATH)) {
      fs.unlinkSync(GLOBAL_CONFIG_PATH);
    }
  }
}
