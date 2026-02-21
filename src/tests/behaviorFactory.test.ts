import { describe, it, expect } from 'vitest';
import { configureBehavior } from '../share/behaviorFactory.js';
import { DeviceModel } from '../roborockCommunication/models/index.js';
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
    const result = configureBehavior(
      DeviceModel.QREVO_EDGE_5V1,
      duid,
      roborockService,
      false,
      cleanModeSettings,
      false,
      logger,
    );
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler for non-smart model', () => {
    const result = configureBehavior('non-smart-model', duid, roborockService, false, cleanModeSettings, false, logger);
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });

  it('returns default handler if forceRunAtDefault is true, even for smart model', () => {
    const result = configureBehavior(
      DeviceModel.QREVO_EDGE_5V1,
      duid,
      roborockService,
      false,
      cleanModeSettings,
      true,
      logger,
    );
    expect(result).toBeInstanceOf(BehaviorDeviceGeneric);
  });
});
