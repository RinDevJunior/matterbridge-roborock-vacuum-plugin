import { debugStringify } from 'matterbridge/logger';
import { ModeHandler, HandlerContext } from '../core/modeHandler.js';
import { CleanModeDisplayLabel } from '../core/cleanModeConfig.js';

export class SmartPlanHandler implements ModeHandler {
  public canHandle(_mode: number, activity: string): boolean {
    return activity === CleanModeDisplayLabel.SmartPlan;
  }

  public async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting)}`);
    await context.roborockService.changeCleanMode(duid, setting);
  }
}
