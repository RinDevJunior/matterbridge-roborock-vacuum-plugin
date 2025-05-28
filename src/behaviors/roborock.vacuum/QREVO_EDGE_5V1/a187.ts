import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';

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
  Smart = 209,
}

//set_mop_mode
export enum MopRouteA187 {
  Fast = 304,
  Standard = 300,
  Deep = 301,
  Custom = 302,
  DeepPlus = 303,
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

const CleanSetting: Record<number, { suctionPower: number; waterFlow: number; mopRoute: number }> = {
  [4]: { suctionPower: 0, waterFlow: 0, mopRoute: MopRouteA187.Smart }, //'Smart Plan'
  [5]: { suctionPower: VacuumSuctionPowerA187.Off, waterFlow: MopWaterFlowA187.Medium, mopRoute: MopRouteA187.Custom }, //'Mop'
  [6]: { suctionPower: VacuumSuctionPowerA187.Balanced, waterFlow: MopWaterFlowA187.Off, mopRoute: MopRouteA187.Custom }, //'Vacuum'
  [7]: { suctionPower: VacuumSuctionPowerA187.Balanced, waterFlow: MopWaterFlowA187.Medium, mopRoute: MopRouteA187.Custom }, //'Vac & Mop'
  [8]: { suctionPower: VacuumSuctionPowerA187.Custom, waterFlow: MopWaterFlowA187.Custom, mopRoute: MopRouteA187.Custom }, // 'Custom'
};

export function setCommandHandlerA187(duid: string, handler: BehaviorDeviceGeneric<DeviceCommands>, logger: AnsiLogger, roborockService: RoborockService): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        logger.notice('BehaviorA187-ChangeRunMode to: ', activity);
        await roborockService.startClean(duid);
        return;
      }
      case 'Smart Plan':
      case 'Mop':
      case 'Vacuum':
      case 'Vac & Mop':
      case 'Custom': {
        const setting = CleanSetting[newMode];
        logger.notice(`BehaviorA187-ChangeCleanMode to: ${activity}, code: ${JSON.stringify(setting)}`);
        await roborockService.changeCleanMode(duid, setting);
        return;
      }
      default:
        logger.notice('BehaviorA187-changeToMode-Unknown: ', newMode);
        return;
    }
  });

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
