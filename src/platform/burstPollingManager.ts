import { RvcOperationalState } from 'matterbridge/matter/clusters';

import { BURST_POLLING_INTERVAL_MS } from '../constants/index.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { generateCorrelationId, runWithCorrelation } from '../share/correlationContext.js';

/**
 * Manages burst polling for robot vacuum devices.
 * Polls at a high frequency after a vacuum command is triggered,
 * stopping automatically when the device returns to an idle/docked state.
 */
export class BurstPollingManager {
	private readonly timers = new Map<string, NodeJS.Timeout>();

	constructor(private readonly platform: RoborockMatterbridgePlatform) {}

	public startBurstPolling(duid: string): void {
		if (this.timers.has(duid)) return;

		const timer = setInterval(() => {
			void runWithCorrelation(generateCorrelationId('burst'), async () => {
				try {
					this.platform.log.notice(`Burst polling for a specific device: ${duid}`);
					await this.requestLocalDeviceStatus(duid);
					if (this.isDeviceIdle(duid)) {
						this.stopBurstPolling(duid);
					}
				} catch (error) {
					this.platform.log.error(`Burst polling failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			});
		}, BURST_POLLING_INTERVAL_MS);

		this.timers.set(duid, timer);
	}

	public stopBurstPolling(duid: string): void {
		const timer = this.timers.get(duid);
		if (timer !== undefined) {
			this.platform.log.notice(`Stop burst polling for a specific device: ${duid}`);
			clearInterval(timer);
			this.timers.delete(duid);
		}
	}

	public stopAllBurstPolling(): void {
		for (const duid of this.timers.keys()) {
			this.stopBurstPolling(duid);
		}
	}

	public has(duid: string): boolean {
		return this.timers.has(duid);
	}

	private async requestLocalDeviceStatus(duid: string): Promise<void> {
		const { roborockService } = this.platform;
		if (roborockService === undefined) return;
		await roborockService.requestDeviceStatusOnce(duid);
	}

	private isDeviceIdle(duid: string): boolean {
		const robot = this.platform.registry.robotsMap.get(duid);
		if (!robot) return true;
		const state: RvcOperationalState.OperationalState = robot.getAttribute(
			RvcOperationalState.Cluster.id,
			'operationalState',
			this.platform.log,
		);
		return (
			state === RvcOperationalState.OperationalState.Docked || state === RvcOperationalState.OperationalState.Charging
		);
	}
}
