import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerCommonCommands } from '../../../../behaviors/roborock.vacuum/core/commonCommands.js';
import { BehaviorDeviceGeneric, CommandNames } from '../../../../behaviors/BehaviorDeviceGeneric.js';
import { createMockLogger, asPartial, createMockRoborockService } from '../../../helpers/testUtils.js';
import type { DeviceCommands } from '../../../../behaviors/BehaviorDeviceGeneric.js';
import type { RoborockService } from '../../../../services/roborockService.js';

function createMockHandler(): BehaviorDeviceGeneric<DeviceCommands> {
  return new BehaviorDeviceGeneric<DeviceCommands>(createMockLogger());
}

function createMockService(): RoborockService {
  return asPartial<RoborockService>({
    setSelectedAreas: vi.fn(),
    pauseClean: vi.fn().mockResolvedValue(undefined),
    resumeClean: vi.fn().mockResolvedValue(undefined),
    stopAndGoHome: vi.fn().mockResolvedValue(undefined),
    playSoundToLocate: vi.fn().mockResolvedValue(undefined),
    stopClean: vi.fn().mockResolvedValue(undefined),
  });
}

describe('registerCommonCommands', () => {
  const duid = 'test-duid';
  const behaviorName = 'TestBehavior';
  let handler: BehaviorDeviceGeneric<DeviceCommands>;
  let service: RoborockService;
  let onActionTriggered: ReturnType<typeof vi.fn>;
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = createMockLogger();
    handler = createMockHandler();
    service = createMockService();
    onActionTriggered = vi.fn();
    registerCommonCommands(duid, handler, logger, service, behaviorName, onActionTriggered);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('SELECT_AREAS command', () => {
    it('should call setSelectedAreas with provided areas', async () => {
      await handler.executeCommand(CommandNames.SELECT_AREAS, [1, 2, 3]);
      expect(service.setSelectedAreas).toHaveBeenCalledWith(duid, [1, 2, 3]);
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-selectAreas: 1,2,3`);
    });

    it('should call setSelectedAreas with empty array when undefined is passed', async () => {
      await handler.executeCommand(CommandNames.SELECT_AREAS, undefined);
      expect(service.setSelectedAreas).toHaveBeenCalledWith(duid, []);
    });
  });

  describe('PAUSE command', () => {
    it('should call pauseClean and not trigger onActionTriggered', async () => {
      await handler.executeCommand(CommandNames.PAUSE);
      expect(service.pauseClean).toHaveBeenCalledWith(duid);
      expect(onActionTriggered).not.toHaveBeenCalled();
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-Pause`);
    });
  });

  describe('RESUME command', () => {
    it('should call resumeClean and trigger onActionTriggered', async () => {
      await handler.executeCommand(CommandNames.RESUME);
      expect(service.resumeClean).toHaveBeenCalledWith(duid);
      expect(onActionTriggered).toHaveBeenCalledOnce();
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-Resume`);
    });
  });

  describe('GO_HOME command', () => {
    it('should call stopAndGoHome and trigger onActionTriggered', async () => {
      await handler.executeCommand(CommandNames.GO_HOME);
      expect(service.stopAndGoHome).toHaveBeenCalledWith(duid);
      expect(onActionTriggered).toHaveBeenCalledOnce();
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-GoHome`);
    });
  });

  describe('IDENTIFY command', () => {
    it('should call playSoundToLocate and not trigger onActionTriggered', async () => {
      await handler.executeCommand(CommandNames.IDENTIFY);
      expect(service.playSoundToLocate).toHaveBeenCalledWith(duid);
      expect(onActionTriggered).not.toHaveBeenCalled();
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-identify`);
    });
  });

  describe('STOP command', () => {
    it('should call stopClean and not trigger onActionTriggered', async () => {
      await handler.executeCommand(CommandNames.STOP);
      expect(service.stopClean).toHaveBeenCalledWith(duid);
      expect(onActionTriggered).not.toHaveBeenCalled();
      expect(logger.notice).toHaveBeenCalledWith(`${behaviorName}-Stop`);
    });
  });

  it('should throw when registering same command handler twice', () => {
    expect(() => registerCommonCommands(duid, handler, logger, service, behaviorName, onActionTriggered)).toThrow(
      /Handler already registered/,
    );
  });
});
