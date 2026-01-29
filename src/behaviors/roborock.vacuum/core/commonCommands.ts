import { AnsiLogger } from 'matterbridge/logger';
import { BehaviorDeviceGeneric, CommandNames, DeviceCommands } from '../../BehaviorDeviceGeneric.js';
import { RoborockService } from '../../../services/roborockService.js';

export function registerCommonCommands(
  duid: string,
  handler: BehaviorDeviceGeneric<DeviceCommands>,
  logger: AnsiLogger,
  roborockService: RoborockService,
  behaviorName: string,
): void {
  handler.setCommandHandler(CommandNames.SELECT_AREAS, async (newAreas: number[] | undefined) => {
    logger.notice(`${behaviorName}-selectAreas: ${newAreas}`);
    roborockService.setSelectedAreas(duid, newAreas ?? []);
  });

  handler.setCommandHandler(CommandNames.PAUSE, async () => {
    logger.notice(`${behaviorName}-Pause`);
    await roborockService.pauseClean(duid);
  });

  handler.setCommandHandler(CommandNames.RESUME, async () => {
    logger.notice(`${behaviorName}-Resume`);
    await roborockService.resumeClean(duid);
  });

  handler.setCommandHandler(CommandNames.GO_HOME, async () => {
    logger.notice(`${behaviorName}-GoHome`);
    await roborockService.stopAndGoHome(duid);
  });

  handler.setCommandHandler(CommandNames.IDENTIFY, async () => {
    logger.notice(`${behaviorName}-identify`);
    await roborockService.playSoundToLocate(duid);
  });

  handler.setCommandHandler(CommandNames.STOP, async () => {
    logger.notice(`${behaviorName}-Stop`);
    await roborockService.stopClean(duid);
  });
}
