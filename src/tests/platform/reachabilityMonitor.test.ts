import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReachabilityMonitor, type ReachabilityMonitorDeps } from '../../platform/reachabilityMonitor.js';
import { createMockLogger } from '../helpers/testUtils.js';

const DELAY_MS = 600_000;
const DUID = 'duid-a';
const OTHER_DUID = 'duid-b';

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 10; i++) {
		await Promise.resolve();
	}
}

function createMockDeps(overrides: Partial<ReachabilityMonitorDeps> = {}) {
	return {
		isEnabled: vi.fn(() => true),
		getDelayMs: vi.fn(() => DELAY_MS),
		getRobotDuids: vi.fn(() => [DUID]),
		apply: vi.fn<ReachabilityMonitorDeps['apply']>().mockResolvedValue(true),
		log: createMockLogger(),
		...overrides,
	};
}

describe('ReachabilityMonitor', () => {
	let clock: { now: number };
	let deps: ReturnType<typeof createMockDeps>;
	let monitor: ReachabilityMonitor;

	function buildMonitor(overrides: Partial<ReachabilityMonitorDeps> = {}): void {
		deps = createMockDeps(overrides);
		monitor = new ReachabilityMonitor({ ...deps, now: () => clock.now });
	}

	beforeEach(() => {
		vi.clearAllMocks();
		clock = { now: 1_000_000 };
		buildMonitor();
	});

	describe('when disabled', () => {
		it('should never call apply from markAlive, applyCloudStatus or sweep when disabled', async () => {
			buildMonitor({ isEnabled: () => false });

			monitor.markAlive(DUID);
			monitor.applyCloudStatus([{ duid: DUID, online: true }]);
			monitor.sweep();
			clock.now += DELAY_MS * 3;
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).not.toHaveBeenCalled();
		});
	});

	describe('going unreachable', () => {
		it('should not flip to unreachable before the delay has elapsed', () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS - 1;

			monitor.sweep();

			expect(deps.apply).not.toHaveBeenCalled();
			expect(monitor.isReachable(DUID)).toBe(true);
		});

		it('should apply reachable=false once when the delay elapses and not repeat on later sweeps', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;

			monitor.sweep();
			await flushMicrotasks();
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(1);
			expect(deps.apply).toHaveBeenCalledWith(DUID, false);
			expect(monitor.isReachable(DUID)).toBe(false);
		});

		it('should not flip a short silence that ends with proof of life (hysteresis)', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS - 1;
			monitor.sweep();

			clock.now += 1;
			monitor.markAlive(DUID);
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).not.toHaveBeenCalled();
			expect(monitor.isReachable(DUID)).toBe(true);
		});

		it('should flip a never-alive device only after the delay measured from the first sweep', async () => {
			monitor.sweep();
			clock.now += DELAY_MS - 1;
			monitor.sweep();
			await flushMicrotasks();
			expect(deps.apply).not.toHaveBeenCalled();

			clock.now += 1;
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(1);
			expect(deps.apply).toHaveBeenCalledWith(DUID, false);
		});
	});

	describe('recovery', () => {
		it('should apply reachable=true immediately on proof of life after going unreachable', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			monitor.markAlive(DUID);
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(2);
			expect(deps.apply).toHaveBeenLastCalledWith(DUID, true);
			expect(monitor.isReachable(DUID)).toBe(true);
		});

		it('should default isReachable to true for an unknown duid', () => {
			expect(monitor.isReachable('unknown')).toBe(true);
		});
	});

	describe('applyCloudStatus', () => {
		it('should act like markAlive for a device reported online', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			monitor.applyCloudStatus([{ duid: DUID, online: true }]);
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenLastCalledWith(DUID, true);
			expect(monitor.isReachable(DUID)).toBe(true);
		});

		it('should not recover a device reported offline', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			monitor.applyCloudStatus([{ duid: DUID, online: false }]);
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(1);
			expect(monitor.isReachable(DUID)).toBe(false);
		});

		it('should not call apply when disabled even for online devices', () => {
			buildMonitor({ isEnabled: () => false });

			monitor.applyCloudStatus([{ duid: DUID, online: true }]);

			expect(deps.apply).not.toHaveBeenCalled();
		});
	});

	describe('multiple devices', () => {
		it('should flip only the silent device and leave the alive device reachable', async () => {
			buildMonitor({ getRobotDuids: () => [DUID, OTHER_DUID] });
			monitor.markAlive(DUID);
			monitor.markAlive(OTHER_DUID);

			clock.now += DELAY_MS;
			monitor.markAlive(OTHER_DUID);
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(1);
			expect(deps.apply).toHaveBeenCalledWith(DUID, false);
			expect(monitor.isReachable(OTHER_DUID)).toBe(true);
		});
	});

	describe('removed devices', () => {
		it('should drop state for a duid no longer in getRobotDuids and never apply for it afterwards', async () => {
			const duids = [DUID];
			buildMonitor({ getRobotDuids: () => duids });
			monitor.markAlive(DUID);

			duids.length = 0;
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).not.toHaveBeenCalled();
			expect(monitor.isReachable(DUID)).toBe(true);
		});
	});

	describe('failure handling', () => {
		it('should log a warning, restore the flag and retry on the next sweep when apply rejects', async () => {
			vi.mocked(deps.apply).mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(true);
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.log.warn).toHaveBeenCalledWith(expect.stringContaining('boom'));
			expect(monitor.isReachable(DUID)).toBe(true);

			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(2);
			expect(monitor.isReachable(DUID)).toBe(false);
		});

		it('should revert the flag and retry on the next sweep when apply resolves false on the way down', async () => {
			vi.mocked(deps.apply).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			expect(monitor.isReachable(DUID)).toBe(true);

			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(2);
			expect(monitor.isReachable(DUID)).toBe(false);
		});

		it('should revert the flag and retry on the next markAlive when apply resolves false on recovery', async () => {
			vi.mocked(deps.apply).mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();

			monitor.markAlive(DUID);
			await flushMicrotasks();
			expect(monitor.isReachable(DUID)).toBe(false);

			monitor.markAlive(DUID);
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(3);
			expect(deps.apply).toHaveBeenLastCalledWith(DUID, true);
			expect(monitor.isReachable(DUID)).toBe(true);
		});

		it('should not throw or reject from markAlive or sweep when apply rejects', async () => {
			vi.mocked(deps.apply).mockRejectedValue(new Error('offline'));
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;

			expect(() => monitor.sweep()).not.toThrow();
			expect(() => monitor.markAlive(DUID)).not.toThrow();
			await flushMicrotasks();

			expect(deps.log.warn).toHaveBeenCalled();
		});
	});

	describe('reset', () => {
		it('should clear state and never call apply', async () => {
			monitor.markAlive(DUID);
			clock.now += DELAY_MS;
			monitor.sweep();
			await flushMicrotasks();
			expect(deps.apply).toHaveBeenCalledTimes(1);

			monitor.reset();
			clock.now += DELAY_MS * 2;
			monitor.sweep();
			await flushMicrotasks();

			expect(deps.apply).toHaveBeenCalledTimes(1);
			expect(monitor.isReachable(DUID)).toBe(true);
		});
	});
});
