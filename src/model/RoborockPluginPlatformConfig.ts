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

export interface AdvancedFeatureSetting {
  clearStorageOnStartup: boolean;
  showRoutinesAsRoom: boolean;
  includeDockStationStatus: boolean;
  includeVacuumErrorStatus: boolean;
  forceRunAtDefault: boolean;
  useVacationModeToSendVacuumToDock: boolean;
  enableCleanModeMapping: boolean;
  cleanModeSettings: CleanModeSettings;
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
