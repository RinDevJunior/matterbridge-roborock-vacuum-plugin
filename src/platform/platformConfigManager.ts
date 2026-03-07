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
	EmailNotificationSettings,
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

	public getProductNameForDevice(serialNumber: string): string | undefined {
		if (!this.isAdvancedFeatureEnabled || !this.overrideMatterConfiguration) {
			return undefined;
		}
		const deviceProductNames = this.advancedFeatureSettings.matterOverrideSettings?.deviceProductNames ?? [];
		return deviceProductNames.find((d) => d.serialNumber === serialNumber)?.productName;
	}

	public ensureDeviceProductNameEntry(serialNumber: string, defaultProductName: string): boolean {
		if (!this.isAdvancedFeatureEnabled || !this.overrideMatterConfiguration) {
			return false;
		}
		const settings = this.advancedFeatureSettings?.matterOverrideSettings;
		if (!settings) return false;

		settings.deviceProductNames ??= [];
		if (settings.deviceProductNames.some((d) => d.serialNumber === serialNumber)) return false;

		settings.deviceProductNames.push({ serialNumber, productName: defaultProductName });
		return true;
	}

	public get isEmailNotificationEnabled(): boolean {
		return this.isAdvancedFeatureEnabled && (this.advancedFeatureSettings.enableEmailNotification ?? false);
	}

	public get emailNotificationSettings(): EmailNotificationSettings | undefined {
		if (!this.isEmailNotificationEnabled) return undefined;
		return this.advancedFeatureSettings.emailNotificationSettings;
	}

	// ─── Device Filtering ───────────────────────────────────────────────────────

	public isDeviceAllowed(device: { duid?: string }): boolean {
		if (this.hasWhiteListConfig) {
			return this.config.pluginConfiguration.whiteList.some((entry) => entry === device.duid);
		}
		return true;
	}
}
