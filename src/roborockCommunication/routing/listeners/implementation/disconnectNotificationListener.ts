import type { AnsiLogger } from 'matterbridge/logger';

import { EmailNotificationService } from '../../../../services/emailNotificationService.js';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';

export type ConnectionType = 'Local' | 'MQTT';

export class DisconnectNotificationListener implements AbstractConnectionListener {
	public constructor(
		private readonly emailService: EmailNotificationService,
		private readonly logger: AnsiLogger,
		private readonly connectionType: ConnectionType,
	) {}

	public async onDisconnected(duid: string, message: string): Promise<void> {
		this.logger.warn(
			`[DisconnectNotificationListener] ${duid} ${this.connectionType} disconnected — sending email notification`,
		);
		await this.emailService.send(
			`[Roborock] ${this.connectionType} connection dropped: ${duid}`,
			`Device ${duid} lost its ${this.connectionType} connection.\n\nReason: ${message}\nTime: ${new Date().toISOString()}`,
		);
	}

	public async onConnected(duid: string): Promise<void> {
		this.logger.info(
			`[DisconnectNotificationListener] ${duid} ${this.connectionType} connected — sending email notification`,
		);
		await this.emailService.send(
			`[Roborock] ${this.connectionType} connection established: ${duid}`,
			`Device ${duid} successfully connected via ${this.connectionType}.\n\nTime: ${new Date().toISOString()}`,
		);
	}

	public async onError(duid: string, message: string): Promise<void> {
		this.logger.warn(
			`[DisconnectNotificationListener] ${duid} ${this.connectionType} error — sending email notification`,
		);
		await this.emailService.send(
			`[Roborock] ${this.connectionType} connection error: ${duid}`,
			`Device ${duid} encountered a ${this.connectionType} connection error.\n\nError: ${message}\nTime: ${new Date().toISOString()}`,
		);
	}

	public async onOffline(duid: string): Promise<void> {
		this.logger.warn(
			`[DisconnectNotificationListener] ${duid} ${this.connectionType} went offline — sending email notification`,
		);
		await this.emailService.send(
			`[Roborock] ${this.connectionType} connection offline: ${duid}`,
			`Device ${duid} lost network connectivity on ${this.connectionType}.\n\nTime: ${new Date().toISOString()}`,
		);
	}

	public async onClose(duid: string): Promise<void> {
		this.logger.warn(
			`[DisconnectNotificationListener] ${duid} ${this.connectionType} connection closed — sending email notification`,
		);
		await this.emailService.send(
			`[Roborock] ${this.connectionType} connection closed: ${duid}`,
			`Device ${duid} ${this.connectionType} connection was closed.\n\nTime: ${new Date().toISOString()}`,
		);
	}

	public async onReconnect(_duid: string, _message: string): Promise<void> {
		this.logger.debug(_duid);
	}
}
