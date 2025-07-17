export interface ExperimentalFeatureSetting {
  enableExperimentalFeature: boolean;
  advancedFeature: {
    showRoutinesAsRoom: boolean;
    includeDockStationStatus: boolean;
    forceRunAtDefault: boolean;
    useVacationModeToSendVacuumToDock: boolean;
    enableServerMode: boolean;
  };
  cleanModeSettings: CleanModeSettings;
}

export interface CleanModeSettings {
  enableCleanModeMapping: boolean;
  vacuuming?: {
    fanMode: 'Balanced' | string;
    mopRouteMode: 'Standard' | string;
  };
  mopping?: {
    waterFlowMode: 'Medium' | string;
    mopRouteMode: 'Standard' | string;
    distanceOff?: number;
  };
  vacmop?: {
    fanMode: 'Balanced' | string;
    waterFlowMode: 'Medium' | string;
    mopRouteMode: 'Standard' | string;
    distanceOff?: number;
  };
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
