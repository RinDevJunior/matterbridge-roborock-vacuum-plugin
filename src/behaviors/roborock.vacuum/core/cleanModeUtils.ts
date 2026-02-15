import { CleanModeSettings } from '../../../model/RoborockPluginPlatformConfig.js';
import { MopRoute, MopWaterFlow, VacuumSuctionPower } from '../enums/index.js';
import { CleanSequenceType } from '../enums/CleanSequenceType.js';
import { CleanModeDisplayLabel } from './cleanModeConfig.js';
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
    case CleanModeDisplayLabel.MopDefault: {
      const mopSetting = cleanModeSettings?.mopping;
      const waterFlow = MopWaterFlow[mopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off =
        waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (mopSetting?.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return new CleanModeSetting(
        VacuumSuctionPower.Off,
        waterFlow,
        distance_off,
        MopRoute[mopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        CleanSequenceType.Persist,
      );
    }
    case CleanModeDisplayLabel.VacuumDefault: {
      const vacuumSetting = cleanModeSettings?.vacuuming;
      return new CleanModeSetting(
        VacuumSuctionPower[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        MopWaterFlow.Off,
        0,
        MopRoute[vacuumSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        CleanSequenceType.Persist,
      );
    }
    case CleanModeDisplayLabel.MopAndVacuumDefault: {
      const vacmopSetting = cleanModeSettings?.vacmop;
      const waterFlow = MopWaterFlow[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off =
        waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (vacmopSetting?.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return new CleanModeSetting(
        VacuumSuctionPower[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        waterFlow,
        distance_off,
        MopRoute[vacmopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        CleanSequenceType.Persist,
      );
    }
    default:
      return undefined;
  }
};
