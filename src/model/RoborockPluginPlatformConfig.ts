import { PlatformConfig } from 'matterbridge';

export type RoborockPluginPlatformConfig = PlatformConfig & {
	authentication: AuthenticationConfiguration;
	pluginConfiguration: PluginConfiguration;
	advancedFeature: AdvancedFeatureConfiguration;
};

export interface AuthenticationConfiguration {
	username: string;
	region: 'US' | 'EU' | 'CN' | 'RU';
	forceAuthentication: boolean;
	authenticationMethod: 'VerificationCode' | 'Password';
	verificationCode?: string;
	password?: string;
}

export interface PluginConfiguration {
	whiteList: string[];
	enableServerMode: boolean;
	enableMultipleMap: boolean;
	sanitizeSensitiveLogs: boolean;
	refreshInterval: number;
	debug: boolean;
	unregisterOnShutdown: boolean;
}

export interface AdvancedFeatureConfiguration {
	enableAdvancedFeature: boolean;
	settings: AdvancedFeatureSetting;
}

export interface EmailNotificationSettings {
	smtpHost?: string;
	smtpPort?: number;
	smtpSecure?: boolean;
	smtpUser?: string;
	smtpPassword?: string;
	recipient?: string;
}

export interface AdvancedFeatureSetting {
	clearStorageOnStartup: boolean;
	showRoutinesAsRoom: boolean;
	includeDockStationStatus: boolean;
	includeVacuumErrorStatus: boolean;
	forceRunAtDefault: boolean;
	useVacationModeToSendVacuumToDock: boolean;
	enableCleanModeMapping: boolean;
	cleanModeSettings: CleanModeSettings;
	overrideMatterConfiguration: boolean;
	matterOverrideSettings: MatterOverrideSettings;
	enableEmailNotification: boolean;
	emailNotificationSettings: EmailNotificationSettings;
	enableLiveMapUpdates: boolean;
}

export interface DeviceProductNameOverride {
	serialNumber: string;
	productName: string;
}

export interface MatterOverrideSettings {
	matterVendorName: string;
	matterVendorId: number;
	matterProductName: string;
	matterProductId: number;
	deviceProductNames?: DeviceProductNameOverride[];
}

export interface CleanModeSettings {
	vacuuming: VacuumingCleanModeSetting;
	mopping: MoppingCleanModeSetting;
	vacmop: VacMopCleanModeSetting;
}

interface VacuumingCleanModeSetting {
	fanMode: string;
	mopRouteMode: string;
}

interface MoppingCleanModeSetting {
	waterFlowMode: string;
	mopRouteMode: string;
	distanceOff: number;
}

interface VacMopCleanModeSetting {
	fanMode: string;
	waterFlowMode: string;
	mopRouteMode: string;
	distanceOff: number;
}

export function createDefaultAdvancedFeature(): AdvancedFeatureConfiguration {
	return {
		enableAdvancedFeature: false,
		settings: {
			clearStorageOnStartup: false,
			showRoutinesAsRoom: false,
			includeDockStationStatus: false,
			includeVacuumErrorStatus: false,
			forceRunAtDefault: false,
			useVacationModeToSendVacuumToDock: false,
			enableCleanModeMapping: false,
			overrideMatterConfiguration: false,
			cleanModeSettings: {
				vacuuming: {
					fanMode: 'Balanced',
					mopRouteMode: 'Standard',
				},
				mopping: {
					waterFlowMode: 'Medium',
					mopRouteMode: 'Standard',
					distanceOff: 25,
				},
				vacmop: {
					fanMode: 'Balanced',
					waterFlowMode: 'Medium',
					mopRouteMode: 'Standard',
					distanceOff: 25,
				},
			},
			matterOverrideSettings: {
				matterVendorName: 'Matterbridge',
				matterVendorId: 65521,
				matterProductName: 'Robotic Vaccum Cleaner',
				matterProductId: 32768,
				deviceProductNames: [],
			},
			enableEmailNotification: false,
			emailNotificationSettings: {},
			enableLiveMapUpdates: false,
		},
	};
}

export function createDefaultCleanModeSettings(): CleanModeSettings {
	return {
		vacuuming: {
			fanMode: 'Balanced',
			mopRouteMode: 'Standard',
		},
		mopping: {
			waterFlowMode: 'Medium',
			mopRouteMode: 'Standard',
			distanceOff: 25,
		},
		vacmop: {
			fanMode: 'Balanced',
			waterFlowMode: 'Medium',
			mopRouteMode: 'Standard',
			distanceOff: 25,
		},
	};
}
