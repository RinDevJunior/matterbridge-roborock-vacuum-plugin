import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { asPartial, asType } from '../helpers/testUtils.js';
import {
	AuthenticationConfiguration,
	createDefaultAdvancedFeature,
	PluginConfiguration,
	RoborockPluginPlatformConfig,
} from '../../model/RoborockPluginPlatformConfig.js';

function createMockLogger(): AnsiLogger {
	return asType<AnsiLogger>({
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		notice: vi.fn(),
		log: vi.fn(),
	});
}

function createMockConfig(overrides: Partial<RoborockPluginPlatformConfig> = {}): RoborockPluginPlatformConfig {
	return {
		authentication: {
			username: 'testuser',
			region: 'US',
			forceAuthentication: false,
			authenticationMethod: 'Password',
			password: 'pass',
		},
		pluginConfiguration: {
			whiteList: [],
			enableServerMode: false,
			enableMultipleMap: false,
			sanitizeSensitiveLogs: true,
			refreshInterval: 60,
			debug: false,
			unregisterOnShutdown: false,
		} satisfies PluginConfiguration,
		advancedFeature: createDefaultAdvancedFeature(),
		...overrides,
	} as RoborockPluginPlatformConfig;
}

describe('PlatformConfigManager', () => {
	let mockLogger: AnsiLogger;
	let config: RoborockPluginPlatformConfig;
	let manager: PlatformConfigManager;

	beforeEach(() => {
		mockLogger = createMockLogger();
		config = createMockConfig();
		manager = PlatformConfigManager.create(config, mockLogger);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	describe('validateConfig', () => {
		it('should return true for valid config', () => {
			expect(manager.validateConfig()).toBe(true);
		});
		it('should return false and log error if username is missing', () => {
			config.authentication.username = '';
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.validateConfig()).toBe(false);
		});
	});

	describe('validateAuthentication', () => {
		it('should return true for valid password auth', () => {
			expect(manager.validateAuthentication()).toBe(true);
		});
		it('should return false and log error if authentication is missing', () => {
			config = asPartial<RoborockPluginPlatformConfig>({ ...config, authentication: undefined });
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.validateAuthentication()).toBe(false);
			expect(mockLogger.error).toHaveBeenCalledWith(
				'Platform config validation failed: "authentication" object is required',
			);
		});
		it('should return false and log info if password is missing', () => {
			config.authentication = asPartial<AuthenticationConfiguration>({ authenticationMethod: 'Password' });
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.validateAuthentication()).toBe(false);
			expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: password not provided');
		});
		it('should return false and log info if verificationCode is missing for VerificationCode method', () => {
			config.authentication = asPartial<AuthenticationConfiguration>({ authenticationMethod: 'VerificationCode' });
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.validateAuthentication()).toBe(false);
			expect(mockLogger.info).toHaveBeenCalledWith('Platform config validation: verification code not provided');
		});
		it('should return true if verificationCode is present for VerificationCode method', () => {
			config.authentication = asPartial<AuthenticationConfiguration>({
				authenticationMethod: 'VerificationCode',
				verificationCode: '1234',
			});
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.validateAuthentication()).toBe(true);
		});
	});

	describe('getters', () => {
		it('should return username, password, verificationCode, authenticationMethod', () => {
			expect(manager.username).toBe('testuser');
			expect(manager.password).toBe('pass');
			expect(manager.verificationCode).toBe('');
			expect(manager.authenticationMethod).toBe('Password');
		});
		it('should return region in uppercase or default to US', () => {
			expect(manager.region).toBe('US');
			config.authentication.region = 'EU';
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.region).toBe('EU');
		});
		it('should return refreshInterval or default', () => {
			expect(manager.refreshInterval).toBe(60);
			config.pluginConfiguration = asPartial<PluginConfiguration>({
				...config.pluginConfiguration,
				refreshInterval: undefined,
			});
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.refreshInterval).toBeDefined();
		});
		it('should return unregisterOnShutdown, rawConfig', () => {
			expect(manager.unregisterOnShutdown).toBe(false);
			expect(manager.rawConfig).toBe(config);
		});
	});

	describe('experimental features', () => {
		it('should return experimental feature flags and settings', () => {
			expect(manager.isAdvancedFeatureEnabled).toBe(manager.rawConfig.advancedFeature.enableAdvancedFeature);
			expect(manager.advancedFeatureSettings).toBe(manager.rawConfig.advancedFeature.settings);
		});
		it('should return cleanModeSettings in all cases when enabled', () => {
			expect(manager.cleanModeSettings).not.toBeUndefined();
			config.advancedFeature.enableAdvancedFeature = true;
			config.advancedFeature.settings = {
				clearStorageOnStartup: false,
				showRoutinesAsRoom: false,
				forceRunAtDefault: false,
				includeDockStationStatus: false,
				includeVacuumErrorStatus: false,
				enableCleanModeMapping: true,
				useVacationModeToSendVacuumToDock: false,
				cleanModeSettings: createDefaultAdvancedFeature().settings.cleanModeSettings,
				overrideMatterConfiguration: false,
				matterOverrideSettings: {
					matterVendorName: 'xxx',
					matterVendorId: 123,
					matterProductName: 'yy',
					matterProductId: 456,
				},
				enableEmailNotification: false,
				emailNotificationSettings: {},
			};
			config.advancedFeature.enableAdvancedFeature = true;
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.cleanModeSettings).toBeDefined();
		});
		it('should return correct advanced feature flags', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: {
					clearStorageOnStartup: true,
					showRoutinesAsRoom: true,
					forceRunAtDefault: true,
					includeDockStationStatus: true,
					includeVacuumErrorStatus: false,
					enableCleanModeMapping: false,
					useVacationModeToSendVacuumToDock: false,
					cleanModeSettings: createDefaultAdvancedFeature().settings.cleanModeSettings,
					overrideMatterConfiguration: false,
					matterOverrideSettings: {
						matterVendorName: 'xxx',
						matterVendorId: 123,
						matterProductName: 'yy',
						matterProductId: 456,
					},
					enableEmailNotification: false,
					emailNotificationSettings: {},
				},
			};
			config.pluginConfiguration.enableServerMode = true;
			config.pluginConfiguration.enableMultipleMap = false;
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isServerModeEnabled).toBe(true);
			expect(manager.isMultipleMapEnabled).toBe(false);
			expect(manager.showRoutinesAsRoom).toBe(true);
			expect(manager.forceRunAtDefault).toBe(true);
			expect(manager.alwaysExecuteAuthentication).toBe(false);
			expect(manager.includeDockStationStatus).toBe(true);
		});

		it('should return includeVacuumErrorStatus from settings when advanced feature is enabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, includeVacuumErrorStatus: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.includeVacuumErrorStatus).toBe(true);
		});

		it('should return false for includeVacuumErrorStatus when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, includeVacuumErrorStatus: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.includeVacuumErrorStatus).toBe(false);
		});

		it('should return false for useVacationModeToSendVacuumToDock when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, useVacationModeToSendVacuumToDock: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.useVacationModeToSendVacuumToDock).toBe(false);
		});

		it('should return true for useVacationModeToSendVacuumToDock when advanced feature is enabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, useVacationModeToSendVacuumToDock: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.useVacationModeToSendVacuumToDock).toBe(true);
		});

		it('should return false for overrideMatterConfiguration when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, overrideMatterConfiguration: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.overrideMatterConfiguration).toBe(false);
		});

		it('should return true for overrideMatterConfiguration when advanced feature is enabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, overrideMatterConfiguration: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.overrideMatterConfiguration).toBe(true);
		});

		it('should return custom matterOverrideSettings when advanced feature is enabled and override is true', () => {
			const customSettings = {
				matterVendorName: 'MyVendor',
				matterVendorId: 9999,
				matterProductName: 'MyProduct',
				matterProductId: 8888,
			};
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					overrideMatterConfiguration: true,
					matterOverrideSettings: customSettings,
				},
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.matterOverrideSettings).toEqual(customSettings);
		});

		it('should return default matterOverrideSettings when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, overrideMatterConfiguration: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.matterOverrideSettings).toBeDefined();
		});

		it('should return default matterOverrideSettings when overrideMatterConfiguration is false', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, overrideMatterConfiguration: false },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.matterOverrideSettings).toBeDefined();
		});

		it('should return default matterOverrideSettings when enabled+override but matterOverrideSettings is null', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					overrideMatterConfiguration: true,
					matterOverrideSettings: null as unknown as ReturnType<
						typeof createDefaultAdvancedFeature
					>['settings']['matterOverrideSettings'],
				},
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.matterOverrideSettings).toBeDefined();
		});

		it('should return false for isClearStorageOnStartupEnabled when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, clearStorageOnStartup: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isClearStorageOnStartupEnabled).toBe(false);
		});

		it('should return true for isClearStorageOnStartupEnabled when advanced feature is enabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, clearStorageOnStartup: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isClearStorageOnStartupEnabled).toBe(true);
		});

		it('should return false for isCustomCleanModeMappingEnabled when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, enableCleanModeMapping: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isCustomCleanModeMappingEnabled).toBe(false);
		});

		describe('getProductNameForDevice', () => {
			it('should return undefined when advanced feature is disabled', () => {
				config.advancedFeature = {
					enableAdvancedFeature: false,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [{ serialNumber: 'SN123', productName: 'My Vacuum' }],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN123')).toBeUndefined();
			});

			it('should return undefined when overrideMatterConfiguration is false', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: false,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [{ serialNumber: 'SN123', productName: 'My Vacuum' }],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN123')).toBeUndefined();
			});

			it('should return undefined when serial number does not match', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [{ serialNumber: 'SN123', productName: 'My Vacuum' }],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN999')).toBeUndefined();
			});

			it('should return per-device product name when serial number matches', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [
								{ serialNumber: 'SN123', productName: 'Living Room Vacuum' },
								{ serialNumber: 'SN456', productName: 'Bedroom Vacuum' },
							],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN123')).toBe('Living Room Vacuum');
				expect(manager.getProductNameForDevice('SN456')).toBe('Bedroom Vacuum');
			});

			it('should return undefined when deviceProductNames is empty', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN123')).toBeUndefined();
			});

			it('should return undefined when deviceProductNames is not set', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							matterVendorName: 'Matterbridge',
							matterVendorId: 65521,
							matterProductName: 'Default Vacuum',
							matterProductId: 32768,
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.getProductNameForDevice('SN123')).toBeUndefined();
			});
		});

		describe('ensureDeviceProductNameEntry', () => {
			beforeEach(() => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: {
							...createDefaultAdvancedFeature().settings.matterOverrideSettings,
							deviceProductNames: [],
						},
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
			});

			it('should return false when advanced feature is disabled', () => {
				config.advancedFeature.enableAdvancedFeature = false;
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.ensureDeviceProductNameEntry('SN123', 'Vacuum Model')).toBe(false);
			});

			it('should return false when overrideMatterConfiguration is false', () => {
				config.advancedFeature.settings.overrideMatterConfiguration = false;
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.ensureDeviceProductNameEntry('SN123', 'Vacuum Model')).toBe(false);
			});

			it('should return false when matterOverrideSettings is undefined', () => {
				config.advancedFeature = {
					enableAdvancedFeature: true,
					settings: {
						...createDefaultAdvancedFeature().settings,
						overrideMatterConfiguration: true,
						matterOverrideSettings: undefined as unknown as ReturnType<
							typeof createDefaultAdvancedFeature
						>['settings']['matterOverrideSettings'],
					},
				};
				manager = PlatformConfigManager.create(config, mockLogger);
				expect(manager.ensureDeviceProductNameEntry('SN123', 'Vacuum Model')).toBe(false);
			});

			it('should add entry and return true when serial number not present', () => {
				const result = manager.ensureDeviceProductNameEntry('SN123', 'Vacuum Model');
				expect(result).toBe(true);
				expect(manager.getProductNameForDevice('SN123')).toBe('Vacuum Model');
			});

			it('should return false and not duplicate when entry already exists', () => {
				manager.ensureDeviceProductNameEntry('SN123', 'Vacuum Model');
				const result = manager.ensureDeviceProductNameEntry('SN123', 'Other Name');
				expect(result).toBe(false);
				expect(manager.getProductNameForDevice('SN123')).toBe('Vacuum Model');
			});

			it('should add multiple entries for different serial numbers', () => {
				manager.ensureDeviceProductNameEntry('SN123', 'Living Room');
				manager.ensureDeviceProductNameEntry('SN456', 'Bedroom');
				expect(manager.getProductNameForDevice('SN123')).toBe('Living Room');
				expect(manager.getProductNameForDevice('SN456')).toBe('Bedroom');
			});
		});
	});

	describe('email notification', () => {
		it('should return false for isEmailNotificationEnabled when advanced feature is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: { ...createDefaultAdvancedFeature().settings, enableEmailNotification: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isEmailNotificationEnabled).toBe(false);
		});

		it('should return false for isEmailNotificationEnabled when enabled flag is false', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, enableEmailNotification: false },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isEmailNotificationEnabled).toBe(false);
		});

		it('should return true for isEmailNotificationEnabled when advanced feature and email are both enabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: { ...createDefaultAdvancedFeature().settings, enableEmailNotification: true },
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isEmailNotificationEnabled).toBe(true);
		});

		it('should return undefined for emailNotificationSettings when email notification is disabled', () => {
			config.advancedFeature = {
				enableAdvancedFeature: false,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableEmailNotification: true,
					emailNotificationSettings: {
						smtpHost: 'smtp.example.com',
						smtpUser: 'u',
						smtpPassword: 'p',
						recipient: 'r@r.com',
					},
				},
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.emailNotificationSettings).toBeUndefined();
		});

		it('should return emailNotificationSettings when email notification is enabled', () => {
			const emailSettings = {
				smtpHost: 'smtp.example.com',
				smtpPort: 587,
				smtpUser: 'user@example.com',
				smtpPassword: 'secret',
				recipient: 'alert@example.com',
			};
			config.advancedFeature = {
				enableAdvancedFeature: true,
				settings: {
					...createDefaultAdvancedFeature().settings,
					enableEmailNotification: true,
					emailNotificationSettings: emailSettings,
				},
			};
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.emailNotificationSettings).toEqual(emailSettings);
		});
	});

	describe('device filtering', () => {
		it('should allow device if whitelist is empty', () => {
			expect(manager.isDeviceAllowed({ duid: 'abc' })).toBe(true);
		});
		it('should allow device if whitelisted by duid', () => {
			config.pluginConfiguration.whiteList = ['abc'];
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isDeviceAllowed({ duid: 'abc' })).toBe(true);
		});
		it('should deny device if duid is not in whitelist', () => {
			config.pluginConfiguration.whiteList = ['abc'];
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isDeviceAllowed({ duid: 'xyz' })).toBe(false);
		});
		it('should deny device if whitelist has entries but duid is undefined', () => {
			config.pluginConfiguration.whiteList = ['abc'];
			manager = PlatformConfigManager.create(config, mockLogger);
			expect(manager.isDeviceAllowed({})).toBe(false);
		});
	});
});
