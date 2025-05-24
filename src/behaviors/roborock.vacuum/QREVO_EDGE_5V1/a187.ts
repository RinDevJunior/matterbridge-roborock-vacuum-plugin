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

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', //DO NOT HANDLE HERE,
  [2]: 'Cleaning',
  [3]: 'Mapping',
};
const RvcCleanMode: Record<number, string> = {
  [4]: 'Smart Plan',
  [5]: 'Mop',
  [6]: 'Vacuum',
  [7]: 'Mop & Vacuum',
  [8]: 'Custom',
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
      case 'Mop & Vacuum':
      case 'Custom': {
        logger.notice('BehaviorA187-ChangeCleanMode to: ', activity);
        roborockService.setCleanMode(duid, newMode);
        return;
      }
      default:
        logger.notice('BehaviorA187-changeToMode-Unknown: ', newMode);
        return;
    }
  });

  handler.setCommandHandler('selectAreas', async (newAreas: number[]) => {
    logger.notice('BehaviorA187-selectAreas: ', newAreas);
    roborockService.setSelectedAreas(duid, newAreas);
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
