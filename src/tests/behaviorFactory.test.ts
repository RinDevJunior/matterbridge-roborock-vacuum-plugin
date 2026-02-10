import { describe, it, expect } from 'vitest';
import { configureBehavior } from '../share/behaviorFactory.js';
import { SMART_MODELS } from '../constants/index.js';
import { RoborockService } from '../services/roborockService.js';
import { BehaviorDeviceGeneric } from '../behaviors/BehaviorDeviceGeneric.js';
import { CleanModeSettings } from '../model/RoborockPluginPlatformConfig.js';
import { createMockLogger } from './helpers/testUtils.js';

describe('configureBehavior', () => {
  const duid = 'test-duid';
  const cleanModeSettings: CleanModeSettings = {} as CleanModeSettings;
  const roborockService = {} as RoborockService;
  const logger = createMockLogger();

  it('returns smart handler for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const result = configureBehavior(model, duid, roborockService, false, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler for non-smart model', () => {
    const model = 'non-smart-model';
    const result = configureBehavior(model, duid, roborockService, false, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler if forceRunAtDefault is true, even for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const result = configureBehavior(model, duid, roborockService, false, cleanModeSettings, true, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });
});
