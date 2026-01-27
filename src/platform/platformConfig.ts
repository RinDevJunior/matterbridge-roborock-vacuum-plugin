/**
 * Platform configuration manager.
 * Provides validation, defaults, and device allow/deny checks using whiteList/blackList.
 */
import { PlatformConfig } from 'matterbridge';
import type { AnsiLogger } from 'matterbridge/logger';
import { AuthenticationPayload, CleanModeSettings, ExperimentalFeatureSetting, createDefaultExperimentalFeatureSetting } from '../model/ExperimentalFeatureSetting.js';
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from '../constants/index.js';

export type RoborockPluginPlatformConfig = PlatformConfig & {
  whiteList: string[];
  blackList: string[];
  useInterval: boolean;
  refreshInterval: number;
  debug: boolean;
  authentication: AuthenticationPayload;
  enableExperimental: ExperimentalFeatureSetting;
  region?: string;
  unregisterOnShutdown?: boolean;
  enableServerMode: boolean;
  sanitizeSensitiveLogs: boolean;
};

/**
 * Manages platform configuration with validation and defaults.
 */
export class PlatformConfigManager {
  private readonly experimentalFeatures: ExperimentalFeatureSetting;

  private constructor(
    private readonly config: RoborockPluginPlatformConfig,
    private readonly log: AnsiLogger,
  ) {
    this.config.whiteList ??= [];
    this.config.blackList ??= [];
    this.config.enableExperimental ??= createDefaultExperimentalFeatureSetting();
    this.experimentalFeatures = { ...this.config.enableExperimental };

    // Disable multiple map for more investigation
    this.experimentalFeatures.advancedFeature.enableMultipleMap = false;
  }

  /**
   * Create a PlatformConfigManager with defaults applied.
   */
  public static create(config: RoborockPluginPlatformConfig, log: AnsiLogger): PlatformConfigManager {
    return new PlatformConfigManager(config, log);
  }

  public validateConfig(): boolean {
    if (!this.config.username || typeof this.config.username !== 'string') {
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

  // ─── Getters ────────────────────────────────────────────────────────────────

  public get username(): string {
    return this.config.username as string;
  }

  public get password(): string {
    return this.config.authentication?.password ?? '';
  }

  public get verificationCode(): string {
    return this.config.authentication?.verificationCode ?? '';
  }

  public get authenticationMethod(): 'VerificationCode' | 'Password' {
    return this.config.authentication?.authenticationMethod ?? 'Password';
  }

  public get region(): string {
    const configRegion = this.config.region;
    return configRegion?.toUpperCase() ?? 'US';
  }

  public get refreshInterval(): number {
    return this.config.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS;
  }

  public get whiteList(): string[] {
    return this.config.whiteList ?? [];
  }

  public get blackList(): string[] {
    return this.config.blackList ?? [];
  }

  public get unregisterOnShutdown(): boolean {
    return this.config.unregisterOnShutdown ?? false;
  }

  public get rawConfig(): RoborockPluginPlatformConfig {
    return this.config;
  }

  // ─── Experimental Features ──────────────────────────────────────────────────

  public get isExperimentalEnabled(): boolean {
    return this.experimentalFeatures.enableExperimentalFeature;
  }

  public get experimentalSettings(): ExperimentalFeatureSetting {
    return this.experimentalFeatures;
  }

  public get advancedFeatures(): ExperimentalFeatureSetting['advancedFeature'] {
    return this.experimentalFeatures.advancedFeature;
  }

  public get cleanModeSettings(): CleanModeSettings | undefined {
    if (this.isExperimentalEnabled && this.experimentalFeatures.cleanModeSettings?.enableCleanModeMapping) {
      return this.experimentalFeatures.cleanModeSettings;
    }
    return undefined;
  }

  public get isServerModeEnabled(): boolean {
    return this.config.enableServerMode;
  }

  public get isMultipleMapEnabled(): boolean {
    return this.isExperimentalEnabled && this.advancedFeatures.enableMultipleMap;
  }

  public get showRoutinesAsRoom(): boolean {
    return this.isExperimentalEnabled && this.advancedFeatures.showRoutinesAsRoom;
  }

  public get forceRunAtDefault(): boolean {
    return this.isExperimentalEnabled && this.advancedFeatures.forceRunAtDefault;
  }

  public get alwaysExecuteAuthentication(): boolean {
    if (this.isExperimentalEnabled) {
      return this.advancedFeatures.alwaysExecuteAuthentication;
    }
    return true;
  }

  public get includeDockStationStatus(): boolean {
    if (this.isExperimentalEnabled) {
      return this.advancedFeatures.includeDockStationStatus;
    }
    return false;
  }

  // ─── Device Filtering ───────────────────────────────────────────────────────

  /**
   * Decide whether a device is allowed based on whiteList/blackList rules.
   */
  public isDeviceAllowed(device: { duid?: string; deviceName?: string }): boolean {
    const duid = device.duid ?? this.extractDuidFromDeviceName(device.deviceName);
    const name = device.deviceName ?? '';

    // Deny if blacklisted
    for (const entry of this.blackList) {
      if (this.matchesListEntry(entry, duid, name)) return false;
    }

    // If whitelist present, require match
    if (this.whiteList.length > 0) {
      for (const entry of this.whiteList) {
        if (this.matchesListEntry(entry, duid, name)) return true;
      }
      return false;
    }

    return true;
  }

  /**
   * Extract DUID from whitelist entry format "name - duid".
   */
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
