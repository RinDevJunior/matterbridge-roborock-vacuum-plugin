import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from '../../../roborockService.js';

export interface DefaultEndpointCommands extends DeviceCommands {
  selectAreas: (newAreas: number[]) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  PlaySoundToLocate: (identifyTime: number) => MaybePromise;
}

export class DefaultBehavior extends BehaviorRoborock {
  declare state: DefaultBehaviorRoborock.State;
}

export namespace DefaultBehaviorRoborock {
  export class State {
    device!: BehaviorDeviceGeneric<DefaultEndpointCommands>;
  }
}

const RvcRunMode: Record<number, string> = {
  [1]: 'Idle', //DO NOT HANDLE HERE,
  [2]: 'Cleaning',
  [3]: 'Mapping',
};
const RvcCleanMode: Record<number, string> = {
  [4]: 'Mop',
  [5]: 'Vacuum',
};

export function setDefaultCommandHandler(duid: string, handler: BehaviorDeviceGeneric<DeviceCommands>, logger: AnsiLogger, roborockService: RoborockService): void {
  handler.setCommandHandler('changeToMode', async (newMode: number) => {
    const activity = RvcRunMode[newMode] || RvcCleanMode[newMode];
    switch (activity) {
      case 'Cleaning': {
        await roborockService.startClean(duid);
        return;
      }
      case 'Mop':
      case 'Vacuum': {
        logger.notice('DefaultBehavior-ChangeCleanMode to: ', activity);
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

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.notice('DefaultBehavior-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
