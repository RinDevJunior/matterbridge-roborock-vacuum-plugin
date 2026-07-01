import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { DeviceNotifyCallback, NotifyMessageTypes, ServiceAreaUpdateMessage } from '../../../../types/index.js';
import { BatteryMessage, StatusChangeMessage, VacuumError } from '../../../models/index.js';
import { AbstractMessageHandler } from '../abstractMessageHandler.js';

export class SimpleMessageHandler implements AbstractMessageHandler {
	constructor(
		private readonly duid: string,
		private readonly logger: AnsiLogger,
		private readonly deviceNotify: DeviceNotifyCallback | undefined,
	) {}

	public async onError(error: VacuumError): Promise<void> {
		if (!this.deviceNotify) {
			this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
			return Promise.resolve();
		}

		await this.deviceNotify({
			type: NotifyMessageTypes.ErrorOccurred,
			data: {
				duid: error.duid,
				vacuumErrorCode: error.vacuumErrorCode,
				dockErrorCode: error.dockErrorCode,
				dockStationStatus: error.dockStationStatus,
			},
		});
	}

	public async onBatteryUpdate(message: BatteryMessage): Promise<void> {
		if (!this.deviceNotify) {
			this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
			return Promise.resolve();
		}

		await this.deviceNotify({
			type: NotifyMessageTypes.BatteryUpdate,
			data: message,
		});
	}

	public async onStatusChanged(message: StatusChangeMessage): Promise<void> {
		if (!this.deviceNotify) {
			this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
			return Promise.resolve();
		}

		await this.deviceNotify({
			type: NotifyMessageTypes.DeviceStatus,
			data: message,
		});
	}

	public async onCleanModeUpdate(message: CleanModeSetting): Promise<void> {
		if (!this.deviceNotify) {
			this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
			return Promise.resolve();
		}

		await this.deviceNotify({
			type: NotifyMessageTypes.CleanModeUpdate,
			data: {
				...message,
				duid: this.duid,
				seq_type: message.sequenceType,
			},
		});
	}

	public async onServiceAreaUpdate(message: ServiceAreaUpdateMessage): Promise<void> {
		if (!this.deviceNotify) {
			this.logger.debug(`[SimpleMessageHandler]: No deviceNotify callback provided`);
			return Promise.resolve();
		}

		await this.deviceNotify({
			type: NotifyMessageTypes.ServiceAreaUpdate,
			data: message,
		});
	}

	public onAdditionalProps(value: number): Promise<void> {
		// Implement additional properties handling logic here
		return Promise.resolve();
	}

	public async onActiveMapChanged(mapId: number): Promise<void> {
		if (!this.deviceNotify) return;
		await this.deviceNotify({
			type: NotifyMessageTypes.ActiveMapChanged,
			data: { duid: this.duid, mapId },
		});
	}
}
