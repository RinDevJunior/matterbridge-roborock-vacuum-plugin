import { AnsiLogger } from 'matterbridge/logger';

import { LOCAL_REFRESH_INTERVAL_MULTIPLIER } from '../constants/index.js';
import { generateCorrelationId, runWithCorrelation } from '../share/correlationContext.js';
import { Device } from '../roborockCommunication/models/index.js';
import { MessageRoutingService } from './messageRoutingService.js';

/** Polls device status via local network or MQTT. */
export class PollingService {
	private localIntervals = new Map<string, NodeJS.Timeout>();

	constructor(
		private readonly refreshInterval: number,
		private readonly logger: AnsiLogger,
		private readonly messageRoutingService: MessageRoutingService,
	) {}

	/** Start polling device status via local UDP. */
	activateDeviceNotifyOverLocal(device: Device): void {
		this.stopLocalPollingForDevice(device.duid);

		this.logger.debug('Activating device status polling for:', device.duid);

		const interval = setInterval(() => {
			try {
				void runWithCorrelation(generateCorrelationId('poll'), async () => {
					try {
						const messageDispatcher = this.messageRoutingService.getMessageDispatcher(device.duid);
						if (!messageDispatcher) {
							this.logger.error('Local Polling - No message dispatcher for device:', device.duid);
							return;
						}

						await messageDispatcher.getDeviceStatus(device.duid);
					} catch (error) {
						this.logger.error('Failed to get device status:', error);
					}
				});
			} catch (error) {
				this.logger.error('Failed to start polling context:', error);
			}
		}, this.refreshInterval * LOCAL_REFRESH_INTERVAL_MULTIPLIER);

		this.localIntervals.set(device.duid, interval);
	}

	/** Trigger a one-shot local status request without affecting the recurring interval. */
	async requestStatusOnce(duid: string): Promise<void> {
		const messageDispatcher = this.messageRoutingService.getMessageDispatcher(duid);
		if (!messageDispatcher) return;
		try {
			await messageDispatcher.getDeviceStatus(duid);
		} catch (error) {
			this.logger.error('Failed to get device status:', error);
		}
	}

	/** Stop all polling intervals. */
	stopPolling(): void {
		for (const interval of this.localIntervals.values()) {
			clearInterval(interval);
		}
		this.localIntervals.clear();
	}

	private stopLocalPollingForDevice(duid: string): void {
		const interval = this.localIntervals.get(duid);
		if (interval !== undefined) {
			clearInterval(interval);
			this.localIntervals.delete(duid);
		}
	}

	/** Cleanup and shutdown. */
	async shutdown(): Promise<void> {
		this.stopPolling();
	}
}
