import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';
import { VacuumSuctionPower, MopWaterFlow, MopRoute } from '../default/default.js';
import { CleanModeSetting } from './CleanModeSetting.js';

const DISTANCE_OFF_BASE = 210;
const DISTANCE_OFF_MULTIPLIER = 5;
const DISTANCE_OFF_DEFAULT = 25;

/**
 * Get clean mode settings from activity name and user configuration.
 * Maps user-friendly activity names to device-specific power/water/route settings.
 * @param activity - Activity name (e.g., 'Mop: Default', 'Vacuum: Default')
 * @param cleanModeSettings - Optional user-configured clean mode settings
 * @returns Clean mode setting configuration or undefined if activity not recognized
 */
export const getSettingFromCleanMode = (activity: string, cleanModeSettings?: CleanModeSettings): CleanModeSetting | undefined => {
  switch (activity) {
    case 'Mop: Default': {
      const mopSetting = cleanModeSettings?.mopping;
      const waterFlow = MopWaterFlow[mopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off =
        waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (mopSetting?.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return {
        suctionPower: VacuumSuctionPower.Off,
        waterFlow,
        distance_off,
        mopRoute: MopRoute[mopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    case 'Vacuum: Default': {
      const vacuumSetting = cleanModeSettings?.vacuuming;
      return {
        suctionPower: VacuumSuctionPower[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        waterFlow: MopWaterFlow.Off,
        distance_off: 0,
        mopRoute: MopRoute[vacuumSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    case 'Mop & Vacuum: Default': {
      const vacmopSetting = cleanModeSettings?.vacmop;
      const waterFlow = MopWaterFlow[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off =
        waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (vacmopSetting?.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return {
        suctionPower: VacuumSuctionPower[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        waterFlow,
        distance_off,
        mopRoute: MopRoute[vacmopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    default:
      return undefined;
  }
};
