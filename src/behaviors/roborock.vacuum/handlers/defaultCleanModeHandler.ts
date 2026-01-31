import { debugStringify } from 'matterbridge/logger';
import { ModeHandler, HandlerContext } from '../core/modeHandler.js';
import { getSettingFromCleanMode } from '../core/cleanModeUtils.js';
import { CleanModeDisplayLabel } from '../core/cleanModeConfig.js';

export class DefaultCleanModeHandler implements ModeHandler {
  private readonly defaultModes: string[] = [CleanModeDisplayLabel.MopAndVacuumDefault, CleanModeDisplayLabel.MopDefault, CleanModeDisplayLabel.VacuumDefault];

  public canHandle(_mode: number, activity: string): boolean {
    return this.defaultModes.includes(activity);
  }

  public async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting =
      context.enableCleanModeMapping && context.cleanModeSettings
        ? (getSettingFromCleanMode(activity, context.cleanModeSettings) ?? context.cleanSettings[mode])
        : context.cleanSettings[mode];

    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);

    if (setting) {
      await context.roborockService.changeCleanMode(duid, setting);
    }
  }
}
