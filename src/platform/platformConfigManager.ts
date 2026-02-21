/**
 * Platform configuration manager.
 * Provides validation, defaults, and device allow/deny checks using whiteList/blackList.
 */

import type { AnsiLogger } from 'matterbridge/logger';
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from '../constants/index.js';
import {
  AdvancedFeatureSetting,
  CleanModeSettings,
  createDefaultAdvancedFeature,
  createDefaultCleanModeSettings,
  MatterOverrideSettings,
  RoborockPluginPlatformConfig,
} from '../model/RoborockPluginPlatformConfig.js';

/**
 * Manages platform configuration with validation and defaults.
 */
export class PlatformConfigManager {
  private constructor(
    private readonly config: RoborockPluginPlatformConfig,
    private readonly log: AnsiLogger,
  ) {
    this.config.pluginConfiguration.whiteList ??= [];
    this.config.advancedFeature ??= createDefaultAdvancedFeature();
  }

  /**
   * Create a PlatformConfigManager with defaults applied.
   */
  public static create(config: RoborockPluginPlatformConfig, log: AnsiLogger): PlatformConfigManager {
    return new PlatformConfigManager(config, log);
  }

  public validateConfig(): boolean {
    if (!this.config.authentication.username || typeof this.config.authentication.username !== 'string') {
      return false;
    }
    return true;
  }

  /**
   * Validate authentication configuration.
   * Returns true if authentication can proceed.
   */
  public validateAuthentication(): boolean {
    const auth = this.config.authentication;
    if (!auth || typeof auth !== 'object') {
      this.log.error('Platform config validation failed: "authentication" object is required');
      return false;
    }

    const method = auth.authenticationMethod;
    if (method === 'VerificationCode') {
      if (!auth.verificationCode) {
        this.log.info('Platform config validation: verification code not provided');
        return false;
      }
    } else {
      if (!auth.password) {
        this.log.info('Platform config validation: password not provided');
        return false;
      }
    }

    return true;
  }

  // ─── Authentication Configuration ─────────────────────────────────────────────

  public get alwaysExecuteAuthentication(): boolean {
    return this.config.authentication.forceAuthentication;
  }

  public get username(): string {
    return this.config.authentication.username;
  }

  public get password(): string {
    return this.config.authentication.password ?? '';
  }

  public get verificationCode(): string {
    return this.config.authentication.verificationCode ?? '';
  }

  public get authenticationMethod(): 'VerificationCode' | 'Password' {
    return this.config.authentication.authenticationMethod ?? 'Password';
  }

  public get region(): string {
    const configRegion = this.config.authentication.region;
    return configRegion?.toUpperCase() ?? 'US';
  }

  public get rawConfig(): RoborockPluginPlatformConfig {
    return this.config;
  }

  // ─── Plugin Configurations ──────────────────────────────────────────────────

  public get refreshInterval(): number {
    return this.config.pluginConfiguration.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS;
  }

  public get hasWhiteListConfig(): boolean {
    return (this.config.pluginConfiguration.whiteList ?? []).length > 0;
  }

  public get unregisterOnShutdown(): boolean {
    return this.config.pluginConfiguration.unregisterOnShutdown ?? false;
  }

  public get isServerModeEnabled(): boolean {
    return this.config.pluginConfiguration.enableServerMode;
  }

  public get isMultipleMapEnabled(): boolean {
    return this.config.pluginConfiguration.enableMultipleMap;
  }

  // ─── Experimental Features ──────────────────────────────────────────────────

  public get isAdvancedFeatureEnabled(): boolean {
    return this.config.advancedFeature.enableAdvancedFeature;
  }

  public get isClearStorageOnStartupEnabled(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.clearStorageOnStartup;
  }

  public get isCustomCleanModeMappingEnabled(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.enableCleanModeMapping;
  }

  public get advancedFeatureSettings(): AdvancedFeatureSetting {
    return this.config.advancedFeature.settings;
  }

  public get cleanModeSettings(): CleanModeSettings {
    if (this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.enableCleanModeMapping) {
      return this.config.advancedFeature.settings.cleanModeSettings;
    }
    return createDefaultCleanModeSettings();
  }

  public get showRoutinesAsRoom(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.showRoutinesAsRoom;
  }

  public get forceRunAtDefault(): boolean {
    return this.isAdvancedFeatureEnabled && this.advancedFeatureSettings.forceRunAtDefault;
  }

  public get includeDockStationStatus(): boolean {
    if (this.isAdvancedFeatureEnabled) {
      return this.advancedFeatureSettings.includeDockStationStatus;
    }
    return false;
  }

  public get includeVacuumErrorStatus(): boolean {
    if (this.isAdvancedFeatureEnabled) {
      return this.advancedFeatureSettings.includeVacuumErrorStatus;
    }
    return false;
  }

  public get useVacationModeToSendVacuumToDock(): boolean {
    if (this.isAdvancedFeatureEnabled) {
      return this.advancedFeatureSettings.useVacationModeToSendVacuumToDock;
    }
    return false;
  }

  public get overrideMatterConfiguration(): boolean {
    if (this.isAdvancedFeatureEnabled) {
      return this.advancedFeatureSettings.overrideMatterConfiguration ?? false;
    }
    return false;
  }

  public get matterOverrideSettings(): MatterOverrideSettings {
    const defaultSettings = createDefaultAdvancedFeature().settings.matterOverrideSettings;
    if (this.isAdvancedFeatureEnabled && this.overrideMatterConfiguration) {
      return (
        this.advancedFeatureSettings.matterOverrideSettings ??
        createDefaultAdvancedFeature().settings.matterOverrideSettings
      );
    }

    return defaultSettings;
  }

  // ─── Device Filtering ───────────────────────────────────────────────────────

  public isDeviceAllowed(device: { duid?: string; deviceName?: string }): boolean {
    // If whitelist present, require match
    if (this.hasWhiteListConfig) {
      const duid = device.duid ?? this.extractDuidFromDeviceName(device.deviceName);
      const name = device.deviceName ?? '';

      for (const entry of this.config.pluginConfiguration.whiteList) {
        if (this.matchesListEntry(entry, duid, name)) return true;
      }
      return false;
    }

    return true;
  }

  public extractDuidFromWhitelistEntry(entry: string): string | undefined {
    const parts = entry.split('-');
    if (parts.length >= 2) return parts[1].trim();
    return undefined;
  }

  private matchesListEntry(entry: string, duid?: string, name?: string): boolean {
    if (!entry) return false;
    if (duid && entry.includes(duid)) return true;
    if (name && entry.trim() === name.trim()) return true;
    return false;
  }

  private extractDuidFromDeviceName(deviceName?: string): string | undefined {
    if (!deviceName) return undefined;
    const parts = deviceName.split('-');
    if (parts.length >= 2) return parts[1].trim();
    return undefined;
  }
}
