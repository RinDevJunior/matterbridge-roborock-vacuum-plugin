export class CleanModeSettings {
  vacuuming?: {
    fanMode?: string;
    mopRouteMode?: string;
  };
  mopping?: {
    waterFlowMode?: string;
    distanceOff?: number;
    mopRouteMode?: string;
  };
  vacmop?: {
    fanMode?: string;
    waterFlowMode?: string;
    distanceOff?: number;
    mopRouteMode?: string;
  };
}
