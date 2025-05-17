import { MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'node-ansi-logger';
import { BehaviorDeviceGeneric, BehaviorRoborock, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import RoborockService from 'src/roborockService.js';

export interface EndpointCommandsA187 extends DeviceCommands {
  ChangeRunMode: ({ newMode, selectedAreas }: { newMode: number; selectedAreas: number[] }) => MaybePromise;
  ChangeCleanMode: (newMode: number) => MaybePromise;
  Pause: () => MaybePromise;
  Resume: () => MaybePromise;
  GoHome: () => MaybePromise;
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

export function setCommandHandlerA187(duid: string, handler: BehaviorDeviceGeneric<DeviceCommands>, logger: AnsiLogger, roborockService: RoborockService): void {
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
      [1]: 'Smart Plan',
      [2]: 'Mop',
      [3]: 'Vacuum',
      [4]: 'Mop & Vacuum',
      [5]: 'Custom',
    };
    const activity = activityMap[newMode];
    logger.debug('BehaviorA187-ChangeCleanMode to ', activity);
  });

  handler.setCommandHandler('Pause', async () => {
    logger.debug('BehaviorA187-Pause');
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler('Resume', async () => {
    logger.debug('BehaviorA187-Resume');
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler('GoHome', async () => {
    logger.debug('BehaviorA187-GoHome');
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler('PlaySoundToLocate', async (identifyTime: number) => {
    logger.debug('BehaviorA187-PlaySoundToLocate');
    await roborockService.playSoundToLocate(duid);
  });
}
