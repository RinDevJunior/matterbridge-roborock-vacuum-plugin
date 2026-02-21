import { debugStringify } from 'matterbridge/logger';
import { ModeHandler, HandlerContext } from '../core/modeHandler.js';
import { CleanModeDisplayLabel } from '../core/cleanModeConfig.js';

export class PresetCleanModeHandler implements ModeHandler {
  private readonly presetModes: string[] = [
    CleanModeDisplayLabel.VacuumAndMopQuick,
    CleanModeDisplayLabel.VacuumAndMopMax,
    CleanModeDisplayLabel.VacuumAndMopMin,
    CleanModeDisplayLabel.VacuumAndMopQuiet,
    CleanModeDisplayLabel.VacuumAndMopDeep,
    CleanModeDisplayLabel.MopMax,
    CleanModeDisplayLabel.MopMin,
    CleanModeDisplayLabel.MopQuick,
    CleanModeDisplayLabel.MopDeep,
    CleanModeDisplayLabel.VacuumMax,
    CleanModeDisplayLabel.VacuumMin,
    CleanModeDisplayLabel.VacuumQuiet,
    CleanModeDisplayLabel.VacuumQuick,
  ];

  public canHandle(_mode: number, activity: string): boolean {
    return this.presetModes.includes(activity);
  }

  public async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(
      `${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`,
    );

    if (setting) {
      await context.roborockService.changeCleanMode(duid, setting);
    }
  }
}
