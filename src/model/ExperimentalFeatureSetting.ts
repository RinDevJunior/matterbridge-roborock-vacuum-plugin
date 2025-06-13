export interface ExperimentalFeatureSetting {
  enableExperimentalFeature: boolean;
  advancedFeature: {
    showRoutinesAsRoom: boolean;
    includeDockStationStatus: boolean;
    forceRunAtDefault: boolean;
    useVacationModeToSendVacuumToDock: boolean;
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
