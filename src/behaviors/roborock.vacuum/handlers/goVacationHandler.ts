import { CleanModeDisplayLabel } from '../core/cleanModeConfig.js';
import { ModeHandler, HandlerContext } from '../core/modeHandler.js';

export class GoVacationHandler implements ModeHandler {
  public canHandle(_mode: number, activity: string): boolean {
    return activity === CleanModeDisplayLabel.GoVacation;
  }

  public async handle(duid: string, _mode: number, _activity: string, context: HandlerContext): Promise<void> {
    context.logger.notice(`${context.behaviorName}-GoHome`);
    await context.roborockService.stopAndGoHome(duid);
  }
}
