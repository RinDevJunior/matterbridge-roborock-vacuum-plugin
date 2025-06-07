import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';

export interface EndpointCommandsA187 extends DeviceCommands {
  selectAreas: (newAreas: any) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  PlaySoundToLocate: (identifyTime: number) => MaybePromise;
}

export class BehaviorA187 extends BehaviorRoborock {
  declare state: BehaviorRoborockA187.State;
}

export namespace BehaviorRoborockA187 {
  export class State {
    device!: BehaviorDeviceGeneric<EndpointCommandsA187>;
  }
}

//suction_power
export enum VacuumSuctionPowerA187 {
  Quiet = 101,
  Balanced = 102,
  Turbo = 103,
  Max = 104,
  Off = 105,
  Custom = 106,
  MaxPlus = 108,
  Smart = 110,
}

//water_box_mode
export enum MopWaterFlowA187 {
  Off = 200,
  Low = 201,
  Medium = 202,
  High = 203,
  Custom = 204,
  CustomizeWithDistanceOff = 207,
  Smart = 209,
}

//set_mop_mode
export enum MopRouteA187 {
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
  Fast = 304,
  Smart = 306,
}

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', //DO NOT HANDLE HERE,
  [2]: 'Cleaning',
  [3]: 'Mapping',
};
const RvcCleanMode: Record<number, string> = {
  [4]: 'Smart Plan',
  [5]: 'Mop',
  [6]: 'Vacuum',
  [7]: 'Vac & Mop',
  [8]: 'Custom',
};

const CleanSetting: Record<number, { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> = {
  [4]: { suctionPower: 0, waterFlow: 0, distance_off: 0, mopRoute: MopRouteA187.Smart }, //'Smart Plan'
  [5]: { suctionPower: VacuumSuctionPowerA187.Off, waterFlow: MopWaterFlowA187.Medium, distance_off: 0, mopRoute: MopRouteA187.Standard }, //'Mop'
  [6]: { suctionPower: VacuumSuctionPowerA187.Balanced, waterFlow: MopWaterFlowA187.Off, distance_off: 0, mopRoute: MopRouteA187.Standard }, //'Vacuum'
  [7]: { suctionPower: VacuumSuctionPowerA187.Balanced, waterFlow: MopWaterFlowA187.Medium, distance_off: 0, mopRoute: MopRouteA187.Standard }, //'Vac & Mop'
  [8]: { suctionPower: VacuumSuctionPowerA187.Custom, waterFlow: MopWaterFlowA187.Custom, distance_off: 0, mopRoute: MopRouteA187.Custom }, // 'Custom'
};

export function setCommandHandlerA187(
  duid: string,
  handler: BehaviorDeviceGeneric<EndpointCommandsA187>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  cleanModeSettings: CleanModeSettings | undefined,
): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('BehaviorA187-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        return;
      }
      case 'Smart Plan':
      case 'Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorA187-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        return;
      }
      case 'Mop':
      case 'Vacuum':
      case 'Vac & Mop': {
        const setting = cleanModeSettings ? getSettingFromCleanMode(activity, cleanModeSettings) : CleanSetting[newMode];
        logger.notice(`BehaviorA187-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);
        if (setting) {
          await roborockService.changeCleanMode(duid, setting);
        }
        return;
      }
      default:
        logger.notice('BehaviorA187-changeToMode-Unknown: ', newMode);
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
        const waterFlow = MopWaterFlowA187[mopSetting?.waterFlowMode as keyof typeof MopWaterFlowA187] ?? MopWaterFlowA187.Medium;
        const distance_off = waterFlow == MopWaterFlowA187.CustomizeWithDistanceOff ? 210 - 5 * (mopSetting?.distanceOff ?? 25) : 0;
        return {
          suctionPower: VacuumSuctionPowerA187.Off,
          waterFlow,
          distance_off,
          mopRoute: MopRouteA187[mopSetting?.mopRouteMode as keyof typeof MopRouteA187] ?? MopRouteA187.Standard,
        };
      }
      case 'Vacuum': {
        const vacuumSetting = cleanModeSettings?.vacuuming;
        return {
          suctionPower: VacuumSuctionPowerA187[vacuumSetting?.fanMode as keyof typeof VacuumSuctionPowerA187] ?? VacuumSuctionPowerA187.Balanced,
          waterFlow: MopWaterFlowA187.Off,
          distance_off: 0,
          mopRoute: MopRouteA187[vacuumSetting?.mopRouteMode as keyof typeof MopRouteA187] ?? MopRouteA187.Standard,
        };
      }
      case 'Vac & Mop': {
        const vacmopSetting = cleanModeSettings?.vacmop;
        const waterFlow = MopWaterFlowA187[vacmopSetting?.waterFlowMode as keyof typeof MopWaterFlowA187] ?? MopWaterFlowA187.Medium;
        const distance_off = waterFlow == MopWaterFlowA187.CustomizeWithDistanceOff ? 210 - 5 * (vacmopSetting?.distanceOff ?? 25) : 0;
        return {
          suctionPower: VacuumSuctionPowerA187[vacmopSetting?.fanMode as keyof typeof VacuumSuctionPowerA187] ?? VacuumSuctionPowerA187.Balanced,
          waterFlow,
          distance_off,
          mopRoute: MopRouteA187[vacmopSetting?.mopRouteMode as keyof typeof MopRouteA187] ?? MopRouteA187.Standard,
        };
      }
      default:
        return undefined;
    }
  };

  handler.setCommandHandler('selectAreas', async (newAreas: number[]) => {
    logger.notice(`BehaviorA187-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler('pause', async () => {
    logger.notice('BehaviorA187-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('resume', async () => {
    logger.notice('BehaviorA187-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('goHome', async () => {
    logger.notice('BehaviorA187-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.notice('BehaviorA187-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
