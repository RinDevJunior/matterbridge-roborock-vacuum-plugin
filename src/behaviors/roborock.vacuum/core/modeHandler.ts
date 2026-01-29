import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../../../services/roborockService.js';
import { CleanModeSettings } from '../../../model/ExperimentalFeatureSetting.js';
import { CleanModeSetting } from './CleanModeSetting.js';

export interface ModeHandler {
  canHandle(mode: number, activity: string): boolean;
  handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void>;
}

export interface HandlerContext {
  roborockService: RoborockService;
  logger: AnsiLogger;
  cleanModeSettings?: CleanModeSettings;
  cleanSettings: Record<number, CleanModeSetting>;
  behaviorName: string;
}
