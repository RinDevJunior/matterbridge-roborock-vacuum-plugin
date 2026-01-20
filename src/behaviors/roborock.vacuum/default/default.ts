import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, CommandNames, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '@/roborockService.js';
import { CleanModeSettings } from '@/model/ExperimentalFeatureSetting.js';
import { CleanModeDTO, RvcRunMode } from '@/behaviors/index.js';

export interface DefaultEndpointCommands extends DeviceCommands {
  selectAreas: (newAreas: number[]) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  playSoundToLocate: (identifyTime: number) => MaybePromise;
}

export class DefaultBehavior extends BehaviorRoborock {
  declare state: DefaultBehaviorRoborockState;
}

export interface DefaultBehaviorRoborockState {
  device: BehaviorDeviceGeneric<DefaultEndpointCommands>;
}

// suction_power
export enum VacuumSuctionPower {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
}

// water_box_mode
export enum MopWaterFlow {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
}

// set_mop_mode
export enum MopRoute {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
}

export const DefaultRvcCleanMode: Record<number, string> = {
  [5]: 'Mop & Vacuum: Default',
  [6]: 'Mop & Vacuum: Quick',
  [7]: 'Mop & Vacuum: Max',
  [8]: 'Mop & Vacuum: Min',
  [9]: 'Mop & Vacuum: Quiet',
  [10]: 'Mop & Vacuum: Custom',

  [31]: 'Mop: Default',
  [32]: 'Mop: Max',
  [33]: 'Mop: Min',
  [34]: 'Mop: Quick',
  [35]: 'Mop: DeepClean',

  [66]: 'Vacuum: Default',
  [67]: 'Vacuum: Max',
  [68]: 'Vacuum: Quiet',
  [69]: 'Vacuum: Quick',

  [99]: 'Go Vacation',
};

export const DefaultCleanSetting: Record<number, CleanModeDTO> = {
  [5]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Default'
  [6]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast }, // 'Vac & Mop Quick'

  [7]: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Max'
  [8]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Min'
  [9]: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop Quiet'

  [10]: { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Custom, distance_off: 0, mopRoute: MopRoute.Custom }, // 'Vac & Mop Custom -> LowEnergy'

  [31]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Mop Default'
  [32]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.High, distance_off: 0, mopRoute: MopRoute.Standard }, // 'MopMax'
  [33]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Low, distance_off: 0, mopRoute: MopRoute.Standard }, // 'MopMin'
  [34]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Fast }, // 'MopQuick'
  [35]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Deep }, // 'MopDeepClean'

  [66]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vacuum Default'
  [67]: { suctionPower: VacuumSuctionPower.Max, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'VacuumMax'
  [68]: { suctionPower: VacuumSuctionPower.Quiet, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'VacuumQuiet'
  [69]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Fast }, // 'VacuumQuick'
};

/**
 * Register command handlers for default device behavior.
 * Sets up handlers for mode changes, area selection, pause/resume, and navigation.
 */
export function setDefaultCommandHandler(
  duid: string,
  handler: BehaviorDeviceGeneric<DefaultEndpointCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler(CommandNames.CHANGE_TO_MODE, async (newMode: number) => {
    const activity = RvcRunMode[newMode] || DefaultRvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('DefaultBehavior-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        break;
      }

      case 'Go Vacation': {
        logger.notice('DefaultBehavior-GoHome');
        await roborockService.stopAndGoHome(duid);
        break;
      }

      case 'Mop & Vacuum: Custom': {
        const setting = DefaultCleanSetting[newMode];
        logger.notice(`DefaultBehavior-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        break;
      }

      case 'Mop & Vacuum: Default':
      case 'Mop: Default':
      case 'Vacuum: Default': {
        const setting = getSettingFromCleanMode(activity, cleanModeSettings) ?? DefaultCleanSetting[newMode];
        logger.notice(`DefaultBehavior-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        break;
      }

      case 'Mop & Vacuum: Quick':
      case 'Mop & Vacuum: Max':
      case 'Mop & Vacuum: Min':
      case 'Mop & Vacuum: Quiet':
      case 'Mop: Max':
      case 'Mop: Min':
      case 'Mop: Quick':
      case 'Mop: DeepClean':
      case 'Vacuum: Max':
      case 'Vacuum: Min':
      case 'Vacuum: Quiet':
      case 'Vacuum: Quick': {
        const setting = DefaultCleanSetting[newMode];
        logger.notice(`DefaultBehavior-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        break;
      }
      default:
        logger.notice('DefaultBehavior-changeToMode-Unknown: ', newMode);
        break;
    }
  });

  handler.setCommandHandler(CommandNames.SELECT_AREAS, async (newAreas: number[]) => {
    logger.notice(`DefaultBehavior-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler(CommandNames.PAUSE, async () => {
    logger.notice('DefaultBehavior-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler(CommandNames.RESUME, async () => {
    logger.notice('DefaultBehavior-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler(CommandNames.GO_HOME, async () => {
    logger.notice('DefaultBehavior-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler(CommandNames.PLAY_SOUND_TO_LOCATE, async () => {
    logger.notice('DefaultBehavior-playSoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}

const DISTANCE_OFF_BASE = 210;
const DISTANCE_OFF_MULTIPLIER = 5;
const DISTANCE_OFF_DEFAULT = 25;

/**
 * Get clean mode settings from activity name and user configuration.
 * Maps user-friendly activity names to device-specific power/water/route settings.
 */
export const getSettingFromCleanMode = (activity: string, cleanModeSettings?: CleanModeSettings): CleanModeDTO | undefined => {
  if (!cleanModeSettings || !cleanModeSettings.mopping || !cleanModeSettings.vacuuming || !cleanModeSettings.vacmop) {
    return undefined;
  }
  switch (activity) {
    case 'Mop: Default': {
      const mopSetting = cleanModeSettings.mopping;
      const waterFlow = MopWaterFlow[mopSetting.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off = waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (mopSetting.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return {
        suctionPower: VacuumSuctionPower.Off,
        waterFlow,
        distance_off,
        mopRoute: MopRoute[mopSetting.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    case 'Vacuum: Default': {
      const vacuumSetting = cleanModeSettings.vacuuming;
      return {
        suctionPower: VacuumSuctionPower[vacuumSetting.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        waterFlow: MopWaterFlow.Off,
        distance_off: 0,
        mopRoute: MopRoute[vacuumSetting.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    case 'Mop & Vacuum: Default': {
      const vacmopSetting = cleanModeSettings.vacmop;
      const waterFlow = MopWaterFlow[vacmopSetting.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
      const distance_off =
        waterFlow === MopWaterFlow.CustomizeWithDistanceOff ? DISTANCE_OFF_BASE - DISTANCE_OFF_MULTIPLIER * (vacmopSetting.distanceOff ?? DISTANCE_OFF_DEFAULT) : 0;
      return {
        suctionPower: VacuumSuctionPower[vacmopSetting.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
        waterFlow,
        distance_off,
        mopRoute: MopRoute[vacmopSetting.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
      };
    }
    default:
      return undefined;
  }
};
