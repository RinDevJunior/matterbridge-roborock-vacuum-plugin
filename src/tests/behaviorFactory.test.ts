import { describe, it, expect, vi } from 'vitest';
import { configureBehavior } from '../share/behaviorFactory.js';
import { SMART_MODELS } from '../constants/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockService } from '../services/roborockService.js';
import { CleanModeSettings } from '../model/ExperimentalFeatureSetting.js';
import { BehaviorDeviceGeneric } from '../behaviors/BehaviorDeviceGeneric.js';

function createMockLogger(): AnsiLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    logLevel: 'info',
  } as unknown as AnsiLogger;
}

describe('configureBehavior', () => {
  const duid = 'test-duid';
  const cleanModeSettings: CleanModeSettings = {} as CleanModeSettings;
  const roborockService = {} as RoborockService;
  const logger = createMockLogger();

  it('returns smart handler for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const result = configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler for non-smart model', () => {
    const model = 'non-smart-model';
    const result = configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler if forceRunAtDefault is true, even for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const result = configureBehavior(model, duid, roborockService, cleanModeSettings, true, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('calls setCommandHandlerSmart for smart model', async () => {
    const model = Array.from(SMART_MODELS)[0];
    const smartModule = await import('../behaviors/roborock.vacuum/smart/smart.js');
    const spy = vi.spyOn(smartModule, 'setCommandHandlerSmart');
    configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(spy).toHaveBeenCalledWith(duid, expect.any(BehaviorDeviceGeneric), logger, roborockService, cleanModeSettings);
    spy.mockRestore();
  });

  it('calls setDefaultCommandHandler for non-smart model', async () => {
    const model = 'non-smart-model';
    const defaultModule = await import('../behaviors/roborock.vacuum/default/default.js');
    const spy = vi.spyOn(defaultModule, 'setDefaultCommandHandler');
    configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(spy).toHaveBeenCalledWith(duid, expect.any(BehaviorDeviceGeneric), logger, roborockService, cleanModeSettings);
    spy.mockRestore();
  });
});
