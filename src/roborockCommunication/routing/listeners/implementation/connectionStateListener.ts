import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { AbstractClient } from '../../abstractClient.js';
import { MANUAL_RECONNECT_DELAY_MS, MAX_RETRY_COUNT } from '../../../../constants/index.js';

export class ConnectionStateListener implements AbstractConnectionListener {
	protected shouldReconnect = false;
	private manualReconnectTimer: NodeJS.Timeout | undefined = undefined;

	constructor(
		private readonly logger: AnsiLogger,
		private readonly client: AbstractClient,
		private readonly clientName: string,
	) {}

	public start(): void {
		this.shouldReconnect = true;
	}

	public stop(): void {
		this.shouldReconnect = false;
	}

	public async onConnected(duid: string): Promise<void> {
		this.logger.info(`Device ${duid} connected to ${this.clientName}`);
		this.client.retryCount = 0;
		this.shouldReconnect = true;
	}

	public async onReconnect(duid: string, message: string): Promise<void> {
		this.logger.info(`Device ${duid} reconnected to ${this.clientName} with message: ${message}`);
		this.client.retryCount = 0;
	}

	public async onDisconnected(duid: string, message: string): Promise<void> {
		this.logger.error(`Device ${duid} disconnected from ${this.clientName} with message: ${message}`);
		await this.scheduleReconnect(duid);
	}

	public async onOffline(duid: string): Promise<void> {
		this.logger.notice(
			`Device ${duid} went offline on ${this.clientName}, likely due to network issues. Waiting for automatic reconnection.`,
		);
		this.shouldReconnect = false;
	}

	public async onClose(duid: string): Promise<void> {
		this.logger.error(`Device ${duid} connection closed on ${this.clientName}.`);
		await this.scheduleReconnect(duid);
	}

	public async onError(duid: string, message: string): Promise<void> {
		this.logger.error(`Error on device with DUID ${duid}: ${message}`);
		if (message.includes('Connection refused: Not authorized')) {
			this.logger.notice(`Device with DUID ${duid} authorization error, stopping reconnection attempts.`);
			this.shouldReconnect = false;

			// Clear any pending manual reconnect timer to stop the reconnection loop
			if (this.manualReconnectTimer) {
				clearTimeout(this.manualReconnectTimer);
				this.manualReconnectTimer = undefined;
			}
		}
	}

	private async scheduleReconnect(duid: string): Promise<void> {
		if (!this.shouldReconnect) {
			this.logger.notice(`Device ${duid} disconnected from ${this.clientName}, but re-registration is disabled.`);
			return;
		}

		if (this.client.retryCount > MAX_RETRY_COUNT) {
			this.logger.error(`Device with DUID ${duid} has exceeded retry limit, not re-registering.`);
			return;
		}

		this.client.retryCount++;

		if (this.client.isInDisconnectingStep) {
			this.logger.info(`Device with DUID ${duid} is in disconnecting step, skipping re-registration.`);
			return;
		}

		if (this.manualReconnectTimer) {
			clearTimeout(this.manualReconnectTimer);
			this.manualReconnectTimer = undefined;
		}

		this.manualReconnectTimer = setTimeout(() => {
			if (typeof this.client.isConnected === 'function' && this.client.isConnected()) {
				this.logger.info(`Device with DUID ${duid} already reconnected by MQTT library, skipping manual reconnect.`);
				this.client.retryCount = 0;
				return;
			}
			this.logger.info(
				`Manual reconnect: Re-registering device with DUID ${duid} to ${this.clientName} after ${MANUAL_RECONNECT_DELAY_MS / 1000}s.`,
			);
			this.client.connect();
		}, MANUAL_RECONNECT_DELAY_MS);

		this.client.isInDisconnectingStep = false;
	}
}
