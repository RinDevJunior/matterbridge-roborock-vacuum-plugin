/**
 * MQTT health monitor for detecting unresponsive connections.
 * Tracks consecutive query timeouts and determines when a forced reconnect is needed,
 * mirroring the python-roborock health_manager.py concept.
 *
 * @module roborockCommunication/mqtt/mqttHealthMonitor
 */

/**
 * Monitors MQTT query health and determines when reconnection is needed.
 * Tracks consecutive timeouts and enforces a cooldown between restart attempts.
 */
export class MqttHealthMonitor {
	private consecutiveTimeouts = 0;
	private lastRestartAt: number | undefined;

	/**
	 * Creates a new MQTT health monitor.
	 * @param timeoutThreshold - Number of consecutive timeouts before a restart is considered
	 * @param restartCooldownMs - Minimum milliseconds between restart attempts
	 */
	public constructor(
		private readonly timeoutThreshold: number,
		private readonly restartCooldownMs: number,
	) {}

	/**
	 * Records a successful query response and resets the timeout counter.
	 */
	public onSuccess(): void {
		this.consecutiveTimeouts = 0;
	}

	/**
	 * Records a query timeout and increments the consecutive timeout counter.
	 */
	public onTimeout(): void {
		this.consecutiveTimeouts += 1;
	}

	/**
	 * Determines whether a restart should be attempted based on current state.
	 * Returns true only if enough timeouts have accumulated AND sufficient time has passed since the last restart.
	 *
	 * @param now - Current timestamp in milliseconds
	 * @returns true if a reconnect should be attempted, false otherwise
	 */
	public shouldRestart(now: number): boolean {
		if (this.consecutiveTimeouts < this.timeoutThreshold) {
			return false;
		}

		if (this.lastRestartAt === undefined) {
			return true;
		}

		return now - this.lastRestartAt >= this.restartCooldownMs;
	}

	/**
	 * Records that a restart was attempted and resets the timeout counter.
	 * Should be called after a reconnect is initiated.
	 *
	 * @param now - Current timestamp in milliseconds
	 */
	public recordRestart(now: number): void {
		this.lastRestartAt = now;
		this.consecutiveTimeouts = 0;
	}

	/**
	 * Returns the current consecutive timeout count for testing/debugging purposes.
	 */
	public getConsecutiveTimeouts(): number {
		return this.consecutiveTimeouts;
	}
}
