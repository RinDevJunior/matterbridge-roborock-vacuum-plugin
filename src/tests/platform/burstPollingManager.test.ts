import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BurstPollingManager } from '../../platform/burstPollingManager.js';
import { RoborockMatterbridgePlatform } from '../../module.js';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { asPartial, createMockLogger, createMockDeviceRegistry, createMockRoborockService } from '../testUtils.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

function makePlatform(overrides: Partial<RoborockMatterbridgePlatform> = {}): RoborockMatterbridgePlatform {
  return asPartial<RoborockMatterbridgePlatform>({
    log: createMockLogger(),
    registry: createMockDeviceRegistry(),
    roborockService: createMockRoborockService(),
    ...overrides,
  });
}

describe('BurstPollingManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startBurstPolling', () => {
    it('should start a timer for the given duid', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');

      expect(manager.has('duid1')).toBe(true);
    });

    it('should not start a second timer if already polling for duid', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      manager.startBurstPolling('duid1');

      expect(manager.has('duid1')).toBe(true);
      // Only one timer — stop it and confirm it's gone
      manager.stopBurstPolling('duid1');
      expect(manager.has('duid1')).toBe(false);
    });

    it('should call requestDeviceStatusOnce on each tick', async () => {
      const roborockService = createMockRoborockService();
      const registry = createMockDeviceRegistry({}, new Map());
      const platform = makePlatform({ roborockService, registry });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(roborockService.requestDeviceStatusOnce).toHaveBeenCalledWith('duid1');
    });

    it('should stop polling when device becomes idle (Docked)', async () => {
      const robot = asPartial<RoborockVacuumCleaner>({
        getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Docked),
      });
      const registry = createMockDeviceRegistry({}, new Map([['duid1', robot]]));
      const platform = makePlatform({ registry });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(manager.has('duid1')).toBe(false);
    });

    it('should stop polling when device becomes idle (Charging)', async () => {
      const robot = asPartial<RoborockVacuumCleaner>({
        getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Charging),
      });
      const registry = createMockDeviceRegistry({}, new Map([['duid1', robot]]));
      const platform = makePlatform({ registry });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(manager.has('duid1')).toBe(false);
    });

    it('should not stop polling when device is active (Running)', async () => {
      const robot = asPartial<RoborockVacuumCleaner>({
        getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Running),
      });
      const registry = createMockDeviceRegistry({}, new Map([['duid1', robot]]));
      const platform = makePlatform({ registry });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(manager.has('duid1')).toBe(true);
      manager.stopBurstPolling('duid1');
    });

    it('should log error and continue polling when requestDeviceStatusOnce throws', async () => {
      const roborockService = createMockRoborockService({
        requestDeviceStatusOnce: vi.fn().mockRejectedValue(new Error('network error')),
      });
      const platform = makePlatform({ roborockService });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('network error'));
      expect(manager.has('duid1')).toBe(true);
      manager.stopBurstPolling('duid1');
    });

    it('should log error for non-Error thrown values', async () => {
      const roborockService = createMockRoborockService({
        requestDeviceStatusOnce: vi.fn().mockRejectedValue('string error'),
      });
      const platform = makePlatform({ roborockService });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('string error'));
      manager.stopBurstPolling('duid1');
    });
  });

  describe('stopBurstPolling', () => {
    it('should stop and remove timer for a polling duid', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      expect(manager.has('duid1')).toBe(true);

      manager.stopBurstPolling('duid1');

      expect(manager.has('duid1')).toBe(false);
    });

    it('should do nothing if duid is not polling', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      expect(() => manager.stopBurstPolling('nonexistent')).not.toThrow();
      expect(manager.has('nonexistent')).toBe(false);
    });
  });

  describe('stopAllBurstPolling', () => {
    it('should stop all active timers', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      manager.startBurstPolling('duid2');
      manager.startBurstPolling('duid3');

      manager.stopAllBurstPolling();

      expect(manager.has('duid1')).toBe(false);
      expect(manager.has('duid2')).toBe(false);
      expect(manager.has('duid3')).toBe(false);
    });

    it('should do nothing when no timers are active', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      expect(() => manager.stopAllBurstPolling()).not.toThrow();
    });
  });

  describe('has', () => {
    it('returns false when duid is not polling', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      expect(manager.has('duid1')).toBe(false);
    });

    it('returns true when duid is polling', () => {
      const platform = makePlatform();
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');

      expect(manager.has('duid1')).toBe(true);
      manager.stopBurstPolling('duid1');
    });
  });

  describe('requestLocalDeviceStatus (via timer tick)', () => {
    it('should skip requestDeviceStatusOnce when roborockService is undefined', async () => {
      const platform = makePlatform({ roborockService: undefined });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      // No error thrown — early return branch taken
      expect(platform.log.error).not.toHaveBeenCalled();
      manager.stopBurstPolling('duid1');
    });
  });

  describe('isDeviceIdle (via timer tick)', () => {
    it('should stop polling when robot is not found (treated as idle)', async () => {
      const registry = createMockDeviceRegistry({}, new Map());
      const platform = makePlatform({ registry });
      const manager = new BurstPollingManager(platform);

      manager.startBurstPolling('duid1');
      await vi.advanceTimersByTimeAsync(15000);

      expect(manager.has('duid1')).toBe(false);
    });
  });
});
