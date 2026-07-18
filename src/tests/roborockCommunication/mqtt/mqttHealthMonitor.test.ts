import { beforeEach, describe, expect, it } from 'vitest';

import { MqttHealthMonitor } from '../../../roborockCommunication/mqtt/mqttHealthMonitor.js';

describe('MqttHealthMonitor', () => {
	const SMALL_THRESHOLD = 3;
	const SMALL_COOLDOWN_MS = 1000;

	let monitor: MqttHealthMonitor;

	beforeEach(() => {
		monitor = new MqttHealthMonitor(SMALL_THRESHOLD, SMALL_COOLDOWN_MS);
	});

	describe('onSuccess', () => {
		it('should reset consecutiveTimeouts to 0 after prior timeouts were recorded', () => {
			// Arrange
			monitor.onTimeout();
			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(2);

			// Act
			monitor.onSuccess();

			// Assert
			expect(monitor.getConsecutiveTimeouts()).toBe(0);
		});

		it('should reset to 0 even if no prior timeouts', () => {
			// Act
			monitor.onSuccess();

			// Assert
			expect(monitor.getConsecutiveTimeouts()).toBe(0);
		});
	});

	describe('onTimeout', () => {
		it('should increment consecutiveTimeouts by 1 each call', () => {
			expect(monitor.getConsecutiveTimeouts()).toBe(0);

			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(1);

			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(2);

			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(3);
		});
	});

	describe('shouldRestart', () => {
		it('should return false when consecutiveTimeouts < timeoutThreshold', () => {
			const now = 1000;

			monitor.onTimeout(); // count = 1
			expect(monitor.shouldRestart(now)).toBe(false);

			monitor.onTimeout(); // count = 2
			expect(monitor.shouldRestart(now)).toBe(false);
		});

		it('should return true when consecutiveTimeouts >= timeoutThreshold and no prior restart', () => {
			const now = 1000;

			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout(); // count = 3 (meets threshold)

			expect(monitor.shouldRestart(now)).toBe(true);
		});

		it('should return false when threshold is met but cooldown not yet elapsed', () => {
			const now = 1000;

			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout(); // count = 3

			expect(monitor.shouldRestart(now)).toBe(true);

			// Record the restart
			monitor.recordRestart(now);

			// Call shouldRestart before cooldown elapses
			const beforeCooldown = now + SMALL_COOLDOWN_MS - 1;
			expect(monitor.shouldRestart(beforeCooldown)).toBe(false);
		});

		it('should return true again once cooldown has elapsed and timeouts re-accumulate', () => {
			const now = 1000;

			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout(); // count = 3

			monitor.recordRestart(now); // resets count to 0, cooldown starts at `now`

			// New timeouts accumulate again after the restart
			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout(); // count = 3 again

			// Exactly at cooldown time
			const exactCooldown = now + SMALL_COOLDOWN_MS;
			expect(monitor.shouldRestart(exactCooldown)).toBe(true);

			// After cooldown time
			const afterCooldown = now + SMALL_COOLDOWN_MS + 1;
			expect(monitor.shouldRestart(afterCooldown)).toBe(true);
		});

		it('should handle multiple restart cycles with cooldown', () => {
			const now = 1000;

			// First cycle
			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();
			expect(monitor.shouldRestart(now)).toBe(true);

			monitor.recordRestart(now);
			expect(monitor.shouldRestart(now + 500)).toBe(false); // Within cooldown

			// Second cycle (after cooldown, timeouts accumulate again)
			const now2 = now + SMALL_COOLDOWN_MS;
			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();
			expect(monitor.shouldRestart(now2)).toBe(true);
		});
	});

	describe('recordRestart', () => {
		it('should set lastRestartAt and reset consecutiveTimeouts to 0', () => {
			const now = 1000;

			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(3);

			monitor.recordRestart(now);

			expect(monitor.getConsecutiveTimeouts()).toBe(0);
			// Verify we can't restart again without cooldown passing
			expect(monitor.shouldRestart(now)).toBe(false);
		});

		it('should update lastRestartAt on subsequent calls', () => {
			const now1 = 1000;
			const now2 = 2000;

			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();

			monitor.recordRestart(now1);
			expect(monitor.shouldRestart(now1 + 500)).toBe(false); // Cooldown from now1

			// Fast forward and trigger timeouts again
			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();

			monitor.recordRestart(now2);
			// Cooldown now applies from now2, not now1
			expect(monitor.shouldRestart(now2 + 500)).toBe(false);
			// now1's cooldown window would have passed, but lastRestartAt is now2, so now2's cooldown still applies
			expect(monitor.shouldRestart(now1 + SMALL_COOLDOWN_MS)).toBe(false);

			// Once new timeouts accumulate again, now2's cooldown boundary applies
			monitor.onTimeout();
			monitor.onTimeout();
			monitor.onTimeout();
			expect(monitor.shouldRestart(now2 + SMALL_COOLDOWN_MS)).toBe(true);
		});
	});

	describe('getConsecutiveTimeouts', () => {
		it('should return current timeout count', () => {
			expect(monitor.getConsecutiveTimeouts()).toBe(0);

			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(1);

			monitor.onTimeout();
			expect(monitor.getConsecutiveTimeouts()).toBe(2);

			monitor.onSuccess();
			expect(monitor.getConsecutiveTimeouts()).toBe(0);
		});
	});
});
