import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';

export interface EndpointCommandsA51 extends DeviceCommands {
  selectAreas: (newAreas: number[]) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  PlaySoundToLocate: (identifyTime: number) => MaybePromise;
}

export class BehaviorA51 extends BehaviorRoborock {
  declare state: BehaviorRoborockA51.State;
}

export namespace BehaviorRoborockA51 {
  export class State {
    device!: BehaviorDeviceGeneric<EndpointCommandsA51>;
  }
}

//suction_power
export enum VacuumSuctionPowerA51 {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
}

//water_box_mode
export enum MopWaterFlowA51 {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
}

//set_mop_mode
export enum MopRouteA51 {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
}

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', //DO NOT HANDLE HERE,
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
  [5]: { suctionPower: VacuumSuctionPowerA51.Off, waterFlow: MopWaterFlowA51.Medium, distance_off: 0, mopRoute: MopRouteA51.Standard }, //'Mop'
  [6]: { suctionPower: VacuumSuctionPowerA51.Balanced, waterFlow: MopWaterFlowA51.Off, distance_off: 0, mopRoute: MopRouteA51.Standard }, //'Vacuum'
  [7]: { suctionPower: VacuumSuctionPowerA51.Balanced, waterFlow: MopWaterFlowA51.Medium, distance_off: 0, mopRoute: MopRouteA51.Standard }, //'Vac & Mop'
  [8]: { suctionPower: VacuumSuctionPowerA51.Custom, waterFlow: MopWaterFlowA51.Custom, distance_off: 0, mopRoute: MopRouteA51.Custom }, // 'Custom'
};

export function setCommandHandlerA51(
  duid: string,
  handler: BehaviorDeviceGeneric<EndpointCommandsA51>,
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
        logger.notice(`BehaviorA51-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        return;
      }
      case 'Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorA51-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        return;
      }
      default:
        logger.notice('BehaviorA51-changeToMode-Unknown: ', newMode);
        return;
    }
  });

  handler.setCommandHandler('selectAreas', async (newAreas: number[]) => {
    logger.notice(`BehaviorA51-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('BehaviorA51-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('BehaviorA51-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('BehaviorA51-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.notice('BehaviorA51-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });

  const getSettingFromCleanMode = (
    activity: string,
    cleanModeSettings?: CleanModeSettings,
  ): { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number } | undefined => {
    switch (activity) {
      case 'Mop': {
        const mopSetting = cleanModeSettings?.mopping;
        const waterFlow = MopWaterFlowA51[mopSetting?.waterFlowMode as keyof typeof MopWaterFlowA51] ?? MopWaterFlowA51.Medium;
        return {
          suctionPower: VacuumSuctionPowerA51.Off,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRouteA51[mopSetting?.mopRouteMode as keyof typeof MopRouteA51] ?? MopRouteA51.Standard,
        };
      }
      case 'Vacuum': {
        const vacuumSetting = cleanModeSettings?.vacuuming;
        return {
          suctionPower: VacuumSuctionPowerA51[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPowerA51] ?? VacuumSuctionPowerA51.Balanced,
          waterFlow: MopWaterFlowA51.Off,
          distance_off: 0,
          mopRoute: MopRouteA51[vacuumSetting?.mopRouteMode as keyof typeof MopRouteA51] ?? MopRouteA51.Standard,
        };
      }
      case 'Vac & Mop': {
        const vacmopSetting = cleanModeSettings?.vacmop;
        const waterFlow = MopWaterFlowA51[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlowA51] ?? MopWaterFlowA51.Medium;
        return {
          suctionPower: VacuumSuctionPowerA51[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPowerA51] ?? VacuumSuctionPowerA51.Balanced,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRouteA51[vacmopSetting?.mopRouteMode as keyof typeof MopRouteA51] ?? MopRouteA51.Standard,
        };
      }
      default:
        return undefined;
    }
  };
}
