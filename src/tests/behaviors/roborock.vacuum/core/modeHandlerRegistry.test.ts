import { describe, it, expect, vi } from 'vitest';
import { ModeHandlerRegistry } from '../../../../behaviors/roborock.vacuum/core/modeHandlerRegistry.js';
import { ModeHandler, HandlerContext } from '../../../../behaviors/roborock.vacuum/core/modeHandler.js';
import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { createDefaultCleanModeSettings } from '../../../../model/RoborockPluginPlatformConfig.js';
import type { RoborockService } from '../../../../services/roborockService.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { createMockLogger, asPartial } from '../../../helpers/testUtils.js';

describe('ModeHandlerRegistry', () => {
  it('registers handlers and returns this for chaining', () => {
    const registry = new ModeHandlerRegistry();
    const handler: ModeHandler = {
      canHandle: () => false,
      handle: async () => {},
    };

    const result = registry.register(handler);

    expect(result).toBe(registry);
  });

  it('routes to correct handler when canHandle returns true', async () => {
    const registry = new ModeHandlerRegistry();
    const mockHandle = vi.fn().mockResolvedValue(undefined);

    const handler1: ModeHandler = {
      canHandle: () => false,
      handle: async () => {},
    };

    const handler2: ModeHandler = {
      canHandle: (mode, activity) => activity === 'Cleaning',
      handle: mockHandle,
    };

    registry.register(handler1).register(handler2);

    const context: HandlerContext = {
      roborockService: {} as RoborockService,
      logger: createMockLogger(),
      cleanSettings: {},
      behaviorName: 'TestBehavior',
      enableCleanModeMapping: false,
    };

    await registry.handle('test-duid', 2, 'Cleaning', context);

    expect(mockHandle).toHaveBeenCalledWith('test-duid', 2, 'Cleaning', context);
    expect(mockHandle).toHaveBeenCalledTimes(1);
  });

  it('routes to first matching handler when multiple handlers can handle', async () => {
    const registry = new ModeHandlerRegistry();
    const mockHandle1 = vi.fn().mockResolvedValue(undefined);
    const mockHandle2 = vi.fn().mockResolvedValue(undefined);

    const handler1: ModeHandler = {
      canHandle: () => true,
      handle: mockHandle1,
    };

    const handler2: ModeHandler = {
      canHandle: () => true,
      handle: mockHandle2,
    };

    registry.register(handler1).register(handler2);

    const context: HandlerContext = {
      roborockService: {} as RoborockService,
      logger: createMockLogger(),
      cleanSettings: {},
      behaviorName: 'TestBehavior',
      enableCleanModeMapping: false,
    };

    await registry.handle('test-duid', 1, 'Test', context);

    expect(mockHandle1).toHaveBeenCalledTimes(1);
    expect(mockHandle2).not.toHaveBeenCalled();
  });

  it('logs unknown mode when no handler can handle', async () => {
    const registry = new ModeHandlerRegistry();
    const mockNotice = vi.fn();

    const handler: ModeHandler = {
      canHandle: () => false,
      handle: async () => {},
    };

    registry.register(handler);

    const context: HandlerContext = {
      roborockService: {} as RoborockService,
      logger: Object.assign(createMockLogger(), { notice: mockNotice }) as AnsiLogger,
      cleanSettings: {},
      behaviorName: 'TestBehavior',
      enableCleanModeMapping: false,
    };

    await registry.handle('test-duid', 99, 'Unknown', context);

    expect(mockNotice).toHaveBeenCalledWith('TestBehavior-changeToMode-Unknown: ', 99);
  });

  it('passes all parameters correctly to handler', async () => {
    const registry = new ModeHandlerRegistry();
    const mockHandle = vi.fn().mockResolvedValue(undefined);

    const handler: ModeHandler = {
      canHandle: () => true,
      handle: mockHandle,
    };

    registry.register(handler);

    const context: HandlerContext = {
      roborockService: asPartial<RoborockService>({}),
      logger: { notice: vi.fn() } as Partial<AnsiLogger> as AnsiLogger,
      cleanModeSettings: createDefaultCleanModeSettings(),
      cleanSettings: { 5: new CleanModeSetting(102, 202, 0, 300) },
      behaviorName: 'SmartBehavior',
      enableCleanModeMapping: true,
    };

    await registry.handle('duid-123', 5, 'Mop & Vacuum: Default', context);

    expect(mockHandle).toHaveBeenCalledWith('duid-123', 5, 'Mop & Vacuum: Default', context);
  });

  it('handles empty registry gracefully', async () => {
    const registry = new ModeHandlerRegistry();
    const mockNotice = vi.fn();

    const context: HandlerContext = {
      roborockService: {} as RoborockService,
      logger: Object.assign(createMockLogger(), { notice: mockNotice }) as AnsiLogger,
      cleanSettings: {},
      enableCleanModeMapping: false,
      behaviorName: 'TestBehavior',
    };

    await registry.handle('test-duid', 1, 'Test', context);

    expect(mockNotice).toHaveBeenCalledWith('TestBehavior-changeToMode-Unknown: ', 1);
  });
});
