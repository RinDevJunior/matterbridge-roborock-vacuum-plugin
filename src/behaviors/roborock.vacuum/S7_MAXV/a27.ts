import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';

export interface EndpointCommandsA27 extends DeviceCommands {
  selectAreas: (newAreas: any) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  PlaySoundToLocate: (identifyTime: number) => MaybePromise;
}

export class BehaviorA27 extends BehaviorRoborock {
  declare state: BehaviorRoborockA27.State;
}

export namespace BehaviorRoborockA27 {
  export class State {
    device!: BehaviorDeviceGeneric<EndpointCommandsA27>;
  }
}

//suction_power
export enum VacuumSuctionPowerA27 {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
}

//water_box_mode
export enum MopWaterFlowA27 {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
}

//set_mop_mode
export enum MopRouteA27 {
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
  [5]: { suctionPower: VacuumSuctionPowerA27.Off, waterFlow: MopWaterFlowA27.Medium, distance_off: 0, mopRoute: MopRouteA27.Standard }, //'Mop'
  [6]: { suctionPower: VacuumSuctionPowerA27.Balanced, waterFlow: MopWaterFlowA27.Off, distance_off: 0, mopRoute: MopRouteA27.Standard }, //'Vacuum'
  [7]: { suctionPower: VacuumSuctionPowerA27.Balanced, waterFlow: MopWaterFlowA27.Medium, distance_off: 0, mopRoute: MopRouteA27.Standard }, //'Vac & Mop'
  [8]: { suctionPower: VacuumSuctionPowerA27.Custom, waterFlow: MopWaterFlowA27.Custom, distance_off: 0, mopRoute: MopRouteA27.Custom }, // 'Custom'
};

export function setCommandHandlerA27(
  duid: string,
  handler: BehaviorDeviceGeneric<DeviceCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('BehaviorA27-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        return;
      }
      case 'Mop':
      case 'Vacuum':
      case 'Vac & Mop': {
        const setting = cleanModeSettings ? getSettingFromCleanMode(activity, cleanModeSettings) : CleanSetting[newMode];
        logger.notice(`BehaviorA27-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        return;
      }
      case 'Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorA27-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        return;
      }
      default:
        logger.notice('BehaviorA27-changeToMode-Unknown: ', newMode);
        return;
    }
  });

  const getSettingFromCleanMode = (
    activity: string,
    cleanModeSettings?: CleanModeSettings,
  ): { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number } | undefined => {
    switch (activity) {
      case 'Mop': {
        const mopSetting = cleanModeSettings?.mopping;
        const waterFlow = MopWaterFlowA27[mopSetting?.waterFlowMode as keyof typeof MopWaterFlowA27] ?? MopWaterFlowA27.Medium;
        return {
          suctionPower: VacuumSuctionPowerA27.Off,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRouteA27[mopSetting?.mopRouteMode as keyof typeof MopRouteA27] ?? MopRouteA27.Standard,
        };
      }
      case 'Vacuum': {
        const vacuumSetting = cleanModeSettings?.vacuuming;
        return {
          suctionPower: VacuumSuctionPowerA27[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPowerA27] ?? VacuumSuctionPowerA27.Balanced,
          waterFlow: MopWaterFlowA27.Off,
          distance_off: 0,
          mopRoute: MopRouteA27[vacuumSetting?.mopRouteMode as keyof typeof MopRouteA27] ?? MopRouteA27.Standard,
        };
      }
      case 'Vac & Mop': {
        const vacmopSetting = cleanModeSettings?.vacmop;
        const waterFlow = MopWaterFlowA27[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlowA27] ?? MopWaterFlowA27.Medium;
        return {
          suctionPower: VacuumSuctionPowerA27[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPowerA27] ?? VacuumSuctionPowerA27.Balanced,
          waterFlow,
          distance_off: 0,
          mopRoute: MopRouteA27[vacmopSetting?.mopRouteMode as keyof typeof MopRouteA27] ?? MopRouteA27.Standard,
        };
      }
      default:
        return undefined;
    }
  };

  handler.setCommandHandler('selectAreas', async (newAreas: number[]) => {
    logger.notice(`BehaviorA27-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('BehaviorA27-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('BehaviorA27-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('BehaviorA27-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.notice('BehaviorA27-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
