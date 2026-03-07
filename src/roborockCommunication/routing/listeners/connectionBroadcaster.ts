import { AbstractConnectionListener } from './abstractConnectionListener.js';
import { AnsiLogger } from 'matterbridge/logger';

export class ConnectionBroadcaster implements AbstractConnectionListener {
	private listeners: AbstractConnectionListener[] = [];

	constructor(private readonly logger: AnsiLogger) {}

	public register(listener: AbstractConnectionListener): void {
		this.logger.notice(`[ConnectionBroadcaster] register listener`);
		this.listeners.push(listener);
	}

	public unregister(): void {
		this.logger.notice(`[ConnectionBroadcaster] unregister listener`);
		this.listeners = [];
	}

	public async onConnected(duid: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onConnected(duid);
		}
	}

	public async onDisconnected(duid: string, message: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onDisconnected(duid, message);
		}
	}

	public async onOffline(duid: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onOffline(duid);
		}
	}

	public async onClose(duid: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onClose(duid);
		}
	}

	public async onError(duid: string, message: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onError(duid, message);
		}
	}

	public async onReconnect(duid: string, message: string): Promise<void> {
		for (const listener of this.listeners) {
			await listener.onReconnect(duid, message);
		}
	}
}
