export interface AdvancedFeature {
  showRoutinesAsRoom: boolean;
  includeDockStationStatus: boolean;
  forceRunAtDefault: boolean;
  useVacationModeToSendVacuumToDock: boolean;
  enableServerMode: boolean;
  alwaysExecuteAuthentication: boolean;
  enableMultipleMap: boolean;
}

export interface AuthenticationPayload {
  authenticationMethod: 'VerificationCode' | 'Password';
  verificationCode?: string;
  password?: string;
}

export interface ExperimentalFeatureSetting {
  enableExperimentalFeature: boolean;
  advancedFeature: AdvancedFeature;
  cleanModeSettings: CleanModeSettings;
}

interface VacuumingCleanModeSetting {
  fanMode: 'Balanced' | string;
  mopRouteMode: 'Standard' | string;
}

interface MoppingCleanModeSetting {
  waterFlowMode: 'Medium' | string;
  mopRouteMode: 'Standard' | string;
  distanceOff?: number;
}

interface VacMopCleanModeSetting {
  fanMode: 'Balanced' | string;
  waterFlowMode: 'Medium' | string;
  mopRouteMode: 'Standard' | string;
  distanceOff?: number;
}

export interface CleanModeSettings {
  enableCleanModeMapping: boolean;
  vacuuming?: VacuumingCleanModeSetting;
  mopping?: MoppingCleanModeSetting;
  vacmop?: VacMopCleanModeSetting;
}

export function createDefaultExperimentalFeatureSetting(): ExperimentalFeatureSetting {
  return {
    enableExperimentalFeature: false,
    advancedFeature: {
      showRoutinesAsRoom: false,
      includeDockStationStatus: false,
      forceRunAtDefault: false,
      useVacationModeToSendVacuumToDock: false,
      enableServerMode: false,
      alwaysExecuteAuthentication: false,
      enableMultipleMap: false,
    },
    cleanModeSettings: {
      enableCleanModeMapping: false,
      vacuuming: {
        fanMode: 'Balanced',
        mopRouteMode: 'Standard',
      },
      mopping: {
        waterFlowMode: 'Medium',
        mopRouteMode: 'Standard',
      },
      vacmop: {
        fanMode: 'Balanced',
        waterFlowMode: 'Medium',
        mopRouteMode: 'Standard',
      },
    },
  };
}
