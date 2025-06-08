import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';

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
}

// set_mop_mode
export enum MopRoute {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
}

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', // DO NOT HANDLE HERE,
  [2]: 'Cleaning',
  [3]: 'Mapping',
};
const RvcCleanMode: Record<number, string> = {
  [5]: 'Mop',
  [6]: 'Vacuum',
  [7]: 'Vac & Mop',
  [8]: 'Custom',
};

const CleanSetting: Record<number, { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> = {
  [5]: { suctionPower: VacuumSuctionPower.Off, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Mop'
  [6]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Off, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vacuum'
  [7]: { suctionPower: VacuumSuctionPower.Balanced, waterFlow: MopWaterFlow.Medium, distance_off: 0, mopRoute: MopRoute.Standard }, // 'Vac & Mop'
  [8]: { suctionPower: VacuumSuctionPower.Custom, waterFlow: MopWaterFlow.Custom, distance_off: 0, mopRoute: MopRoute.Custom }, // 'Custom'
};

export function setDefaultCommandHandler(
  duid: string,
  handler: BehaviorDeviceGeneric<DefaultEndpointCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        await roborockService.startClean(duid);
        return;
      }
      case 'Mop':
      case 'Vacuum':
      case 'Vac & Mop': {
        const setting = cleanModeSettings ? getSettingFromCleanMode(activity, cleanModeSettings) : CleanSetting[newMode];
        logger.notice(`DefaultBehavior-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        return;
      }
      case 'Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`DefaultBehavior-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        return;
      }
      default:
        logger.notice('DefaultBehavior-changeToMode-Unknown: ', newMode);
        return;
    }
  });

  handler.setCommandHandler('selectAreas', async (newAreas: number[]) => {
    logger.notice(`DefaultBehavior-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('DefaultBehavior-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('DefaultBehavior-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('DefaultBehavior-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('playSoundToLocate', async () => {
    logger.notice('DefaultBehavior-playSoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });

  const getSettingFromCleanMode = (
    activity: string,
    cleanModeSettings?: CleanModeSettings,
  ): { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number } | undefined => {
    switch (activity) {
      case 'Mop': {
        const mopSetting = cleanModeSettings?.mopping;
        const waterFlow = MopWaterFlow[mopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
        return {
          suctionPower: VacuumSuctionPower.Off,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRoute[mopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        };
      }
      case 'Vacuum': {
        const vacuumSetting = cleanModeSettings?.vacuuming;
        return {
          suctionPower: VacuumSuctionPower[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
          waterFlow: MopWaterFlow.Off,
          distance_off: 0,
          mopRoute: MopRoute[vacuumSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        };
      }
      case 'Vac & Mop': {
        const vacmopSetting = cleanModeSettings?.vacmop;
        const waterFlow = MopWaterFlow[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlow] ?? MopWaterFlow.Medium;
        return {
          suctionPower: VacuumSuctionPower[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPower] ?? VacuumSuctionPower.Balanced,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRoute[vacmopSetting?.mopRouteMode as keyof typeof MopRoute] ?? MopRoute.Standard,
        };
      }
      default:
        return undefined;
    }
  };
}
