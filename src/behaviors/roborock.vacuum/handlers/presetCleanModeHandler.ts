import { debugStringify } from 'matterbridge/logger';
import { ModeHandler, HandlerContext } from '../core/modeHandler.js';

export class PresetCleanModeHandler implements ModeHandler {
  private readonly presetModes = [
    'Mop & Vacuum: Quick',
    'Mop & Vacuum: Max',
    'Mop & Vacuum: Min',
    'Mop & Vacuum: Quiet',
    'Mop: Max',
    'Mop: Min',
    'Mop: Quick',
    'Mop: DeepClean',
    'Vacuum: Max',
    'Vacuum: Min',
    'Vacuum: Quiet',
    'Vacuum: Quick',
  ];

  public canHandle(_mode: number, activity: string): boolean {
    return this.presetModes.includes(activity);
  }

  public async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const setting = context.cleanSettings[mode];
    context.logger.notice(`${context.behaviorName}-ChangeCleanMode to: ${activity}, setting: ${debugStringify(setting ?? {})}`);

    if (setting) {
      await context.roborockService.changeCleanMode(duid, setting);
    }
  }
}
