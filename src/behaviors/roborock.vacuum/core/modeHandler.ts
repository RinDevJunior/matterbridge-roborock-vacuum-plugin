import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../services/roborockService.js';
import { CleanModeSetting } from './CleanModeSetting.js';
import { CleanModeSettings } from '../../../model/RoborockPluginPlatformConfig.js';

export interface ModeHandler {
  canHandle(mode: number, activity: string): boolean;
  handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void>;
}

export interface HandlerContext {
  roborockService: RoborockService;
  logger: AnsiLogger;

  enableCleanModeMapping: boolean;
  cleanModeSettings?: CleanModeSettings;
  cleanSettings: Record<number, CleanModeSetting>;
  behaviorName: string;
}
