import { ModeHandler, HandlerContext } from '../core/modeHandler.js';
import { RunModeDisplayLabel } from '../core/runModeConfig.js';

export class CleaningModeHandler implements ModeHandler {
  public canHandle(_mode: number, activity: string): boolean {
    return activity === RunModeDisplayLabel.Cleaning;
  }

  public async handle(duid: string, _mode: number, activity: string, context: HandlerContext): Promise<void> {
    context.logger.notice(`${context.behaviorName}-ChangeRunMode to:`, activity);
    await context.roborockService.startClean(duid);
  }
}
