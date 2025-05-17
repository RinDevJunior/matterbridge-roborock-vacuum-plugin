import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'node-ansi-logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from 'src/roborockService.js';

export interface DefaultEndpointCommands extends DeviceCommands {
  ChangeRunMode: ({ newMode, selectedAreas }: { newMode: number; selectedAreas: number[] }) => MaybePromise;
  ChangeCleanMode: (newMode: number) => MaybePromise;
  Pause: () => MaybePromise;
  Resume: () => MaybePromise;
  GoHome: () => MaybePromise;
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

export function setDefaultCommandHandler(duid: string, handler: BehaviorDeviceGeneric<DeviceCommands>, logger: AnsiLogger, roborockService: RoborockService): void {
  handler.setCommandHandler('ChangeRunMode', async ({ newMode, selectedAreas }) => {
    const activityMap: Record<number, string> = {
      [1]: 'Idle',
      [2]: 'Cleaning',
      [3]: 'Mapping',
    };
    const activity = activityMap[newMode];
    switch (activity) {
      case 'Cleaning': {
        await roborockService.startClean(duid, selectedAreas);
        return;
      }
      default:
        return;
    }
  });

  handler.setCommandHandler('ChangeCleanMode', async (newMode) => {
    const activityMap: Record<number, string> = {
      [1]: 'Vacuum',
      [2]: 'Mop',
    };
    const activity = activityMap[newMode];
    logger.debug('DefaultBehavior-ChangeCleanMode to ', activity);
  });

  handler.setCommandHandler('Pause', async () => {
    logger.debug('DefaultBehavior-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('Resume', async () => {
    logger.debug('DefaultBehavior-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('GoHome', async () => {
    logger.debug('DefaultBehavior-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.debug('DefaultBehavior-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
