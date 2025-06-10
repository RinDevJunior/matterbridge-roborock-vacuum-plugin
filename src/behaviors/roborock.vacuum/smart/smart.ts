import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';
import { RvcCleanMode as DefaultRvcCleanMode, CleanSetting as DefaultCleanSetting, getSettingFromCleanMode, RvcRunMode } from '../default/default.js';

export interface EndpointCommandsSmart extends DeviceCommands {
  selectAreas: (newAreas: number[] | undefined) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  playSoundToLocate: (identifyTime: number) => MaybePromise;
}

export class BehaviorSmart extends BehaviorRoborock {
  declare state: BehaviorRoborockSmartState;
}

export interface BehaviorRoborockSmartState {
  device: BehaviorDeviceGeneric<EndpointCommandsSmart>;
}

// get_custom_mode
export enum VacuumSuctionPowerSmart {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
  Smart = 110,
}

// get_water_box_custom_mode
export enum MopWaterFlowSmart {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
  Smart = 209,
}

// get_mop_mode
export enum MopRouteSmart {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
  Smart = 306,
}

export const RvcCleanMode: Record<number, string> = {
  [4]: 'Smart Plan',
  ...DefaultRvcCleanMode,
};

// { suctionPower: [ 102 ], waterFlow: 200, distance_off: 0, mopRoute: [ 102 ] }
export const CleanSetting: Record<number, { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> = {
  [4]: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: MopRouteSmart.Smart }, // 'Smart Plan'
  ...DefaultCleanSetting,
};

export function setCommandHandlerSmart(
  duid: string,
  handler: BehaviorDeviceGeneric<EndpointCommandsSmart>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('BehaviorSmart-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        break;
      }

      case 'Go Vacation': {
        logger.notice('DefaultBehavior-GoHome');
        await roborockService.stopAndGoHome(duid);
        break;
      }

      case 'Smart Plan':
      case 'Mop & Vacuum: Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        break;
      }

      case 'Mop & Vacuum: Default':
      case 'Mop: Default':
      case 'Vacuum: Default': {
        const setting = cleanModeSettings ? (getSettingFromCleanMode(activity, cleanModeSettings) ?? CleanSetting[newMode]) : CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
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
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorSmart-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        break;
      }
      default:
        logger.notice('BehaviorSmart-changeToMode-Unknown: ', newMode);
        break;
    }
  });

  handler.setCommandHandler('selectAreas', async (newAreas: number[] | undefined) => {
    logger.notice(`BehaviorSmart-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('BehaviorSmart-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('BehaviorSmart-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('BehaviorSmart-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('playSoundToLocate', async () => {
    logger.notice('BehaviorSmart-playSoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
