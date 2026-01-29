import { describe, it, expect, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import { RoborockMatterbridgePlatform } from '../module.js';

function makeLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
    logLevel: 'info',
  } as unknown as AnsiLogger;
}

function makeMatterbridge(overrides: Record<string, unknown> = {}) {
  return {
    matterbridgeVersion: '3.5.1',
    matterbridgePluginDirectory: '/tmp',
    matterbridgeDirectory: '/tmp',
    verifyMatterbridgeVersion: () => true,
    ...overrides,
  } as any;
}

describe('RoborockMatterbridgePlatform - startup branches', () => {
  it('onStart returns early when username is undefined', async () => {
    const logger = makeLogger();
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, { name: 'Test' } as any);
    // ready and persist stubs
    (platform as any).ready = Promise.resolve();
    (platform as any).persist = { init: async () => {}, getItem: async () => undefined, setItem: async () => {} };

    await platform.onStart();
    expect(logger.log as any).toHaveBeenCalled();
  });

  it('onStart logs error when startDeviceDiscovery returns false', async () => {
    const logger = makeLogger();
    const cfg: any = { name: 'Test', username: 'u@example.com', authentication: {} };
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, cfg);
    (platform as any).ready = Promise.resolve();
    (platform as any).persist = { init: async () => {}, getItem: async () => undefined, setItem: async () => {} };

    // force startDeviceDiscovery to return false
    (platform as any).startDeviceDiscovery = async () => false;

    await platform.onStart();

    expect(logger.log as any).toHaveBeenCalledWith('error', 'Device discovery failed to start.');
  });

  it('onConfigure returns early if not started', async () => {
    const logger = makeLogger();
    const cfg: any = { name: 'Test', username: 'u@example.com', authentication: {} };
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, cfg);
    // isStartPluginCompleted defaults to false - ensure no exception
    await platform.onConfigure();
    expect(logger.log as any).toHaveBeenCalled();
  });

  it('configureDevice returns false when roborockService undefined', async () => {
    const logger = makeLogger();
    const cfg: any = { name: 'Test', username: 'u@example.com', authentication: {} };
    const platform = new RoborockMatterbridgePlatform(makeMatterbridge(), logger, cfg);
    const vacuum = { duid: 'duid-1', name: 'Vac', serialNumber: 's1' } as any;

    const result = await (platform as any).configureDevice(vacuum);
    expect(result).toBe(false);
    expect(logger.log as any).toHaveBeenCalledWith('error', 'Initializing: RoborockService is undefined');
  });
});
