import { describe, it, expect, vi } from 'vitest';
import { configureBehavior, BehaviorFactoryResult } from '../behaviorFactory.js';
import { SMART_MODELS } from '../constants/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../roborockService.js';
import { CleanModeSettings } from '../model/ExperimentalFeatureSetting.js';
import { BehaviorDeviceGeneric } from '../behaviors/BehaviorDeviceGeneric.js';
import { DefaultEndpointCommands } from '../behaviors/roborock.vacuum/default/default.js';
import { EndpointCommandsSmart } from '../behaviors/roborock.vacuum/smart/smart.js';

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
    // Should be typed as smart
    expect((result as BehaviorDeviceGeneric<EndpointCommandsSmart>).configureHandler).toBeDefined();
  });

  it('returns default handler for non-smart model', () => {
    const model = 'non-smart-model';
    const result = configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
    // Should be typed as default
    expect((result as BehaviorDeviceGeneric<DefaultEndpointCommands>).configureHandler).toBeDefined();
  });

  it('returns default handler if forceRunAtDefault is true, even for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const result = configureBehavior(model, duid, roborockService, cleanModeSettings, true, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
    expect((result as BehaviorDeviceGeneric<DefaultEndpointCommands>).configureHandler).toBeDefined();
  });

  it('calls setCommandHandlerSmart for smart model', () => {
    const model = Array.from(SMART_MODELS)[0];
    const spy = vi.spyOn(require('../behaviors/roborock.vacuum/smart/smart.js'), 'setCommandHandlerSmart');
    configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(spy).toHaveBeenCalledWith(duid, expect.any(BehaviorDeviceGeneric), logger, roborockService, cleanModeSettings);
    spy.mockRestore();
  });

  it('calls setDefaultCommandHandler for non-smart model', () => {
    const model = 'non-smart-model';
    const spy = vi.spyOn(require('../behaviors/roborock.vacuum/default/default.js'), 'setDefaultCommandHandler');
    configureBehavior(model, duid, roborockService, cleanModeSettings, false, logger);
    expect(spy).toHaveBeenCalledWith(duid, expect.any(BehaviorDeviceGeneric), logger, roborockService, cleanModeSettings);
    spy.mockRestore();
  });
});
