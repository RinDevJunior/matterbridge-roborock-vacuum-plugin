import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { DockStationStatus } from '../../../../model/DockStationStatus.js';
import {
	BatteryMessage,
	DeviceStatus,
	DpsPayload,
	Protocol,
	ResponseMessage,
	StatusChangeMessage,
	VacuumError,
} from '../../../models/index.js';
import { AbstractMessageHandler } from '../../handlers/abstractMessageHandler.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class V1StatusListener implements AbstractMessageListener {
	readonly name = 'V1StatusListener';

	private handler: AbstractMessageHandler | undefined;
	constructor(
		public readonly duid: string,
		private readonly logger: AnsiLogger,
	) {}

	public registerHandler(handler: AbstractMessageHandler): void {
		this.handler = handler;
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) {
			this.logger.debug(
				`[V1StatusListener]: Message DUID ${message.duid} does not match listener DUID ${this.duid}`,
			);
			return;
		}

		if (!this.handler) {
			this.logger.error(`[V1StatusListener]: No handler registered`);
			return;
		}

		if (!message.isForProtocols([Protocol.general_request, Protocol.rpc_response])) {
			this.logger.debug(`[V1StatusListener]: Message not for general_request or rpc_response protocol`);
			return;
		}

		if (message.isSimpleOkResponse()) {
			this.logger.debug(`[V1StatusListener]: Ignoring simple 'ok' response`);
			return;
		}

		const rpcData = message.get(Protocol.rpc_response) as DpsPayload;

		if (!rpcData || !rpcData.result || !Array.isArray(rpcData.result) || rpcData.result.length === 0) {
			this.logger.debug(`[V1StatusListener]: No rpc_response data found in message`);
			return;
		}

		const rawResult = rpcData.result[0];
		if (typeof rawResult !== 'object' || rawResult === null) {
			this.logger.debug('[V1StatusListener]: result[0] is not an object, skipping');
			return;
		}

		const deviceStatus = new DeviceStatus(message.duid, rawResult);
		const vacuumErrorCode = deviceStatus.getVacuumErrorCode();
		const dockErrorCode = deviceStatus.getDockErrorCode();
		const dockStationStatusCode = deviceStatus.getDockStationStatus();
		const battery = deviceStatus.getBattery();
		const chargeStatus = deviceStatus.getChargeStatus();
		const messageBody = deviceStatus.getMessage();
		const cleaningInfo = messageBody.cleaning_info;
		const clean_area = messageBody.clean_area;
		const clean_time = messageBody.clean_time;

		if (!('state' in messageBody)) {
			this.logger.debug('[V1StatusListener]: Message does not contain state');
			return Promise.resolve();
		}

		const state = messageBody.state;
		const cleanMode = new CleanModeSetting(
			cleaningInfo?.fan_power ?? messageBody.fan_power,
			cleaningInfo?.water_box_status ?? messageBody.water_box_mode,
			messageBody.distance_off,
			cleaningInfo?.mop_mode ?? messageBody.mop_mode,
			messageBody.seq_type,
		);

		const batteryMessage = new BatteryMessage(message.duid, battery, chargeStatus, state);

		const dockStationStatus =
			dockStationStatusCode !== undefined ? DockStationStatus.parseDockStationStatus(dockStationStatusCode) : undefined;
		const hasDockStationError = dockStationStatus?.hasError() ?? false;

		if (
			(vacuumErrorCode !== undefined && vacuumErrorCode !== 0) ||
			(dockErrorCode !== undefined && dockErrorCode !== 0) ||
			hasDockStationError
		) {
			await this.handler.onError(new VacuumError(message.duid, vacuumErrorCode, dockErrorCode, dockStationStatusCode));
		}

		const statusChangeMessage = new StatusChangeMessage(
			message.duid,
			state,
			messageBody.in_cleaning !== undefined ? Boolean(messageBody.in_cleaning) : undefined,
			messageBody.in_returning !== undefined ? Boolean(messageBody.in_returning) : undefined,
			messageBody.in_fresh_state !== undefined ? Boolean(messageBody.in_fresh_state) : undefined,
			messageBody.is_locating !== undefined ? Boolean(messageBody.is_locating) : undefined,
			messageBody.is_exploring !== undefined ? Boolean(messageBody.is_exploring) : undefined,
			messageBody.in_warmup !== undefined ? Boolean(messageBody.in_warmup) : undefined,
		);

		await this.handler.onBatteryUpdate(batteryMessage);
		await this.handler.onStatusChanged(statusChangeMessage);
		await this.handler.onCleanModeUpdate(cleanMode);
		await this.handler.onServiceAreaUpdate({
			duid: message.duid,
			state: state,
			cleaningProcess: {
				clean_area: clean_area,
				clean_time: clean_time,
			},
			cleaningInfo: cleaningInfo,
		});
	}
}
