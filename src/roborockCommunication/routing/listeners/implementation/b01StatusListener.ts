import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { DockErrorCode } from '../../../enums/index.js';
import { OperationStatusCode } from '../../../enums/operationStatusCode.js';
import { Q7RequestCode, Q7RequestMethod } from '../../../enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../enums/Q10RequestCode.js';
import { BatteryMessage, ResponseMessage, StatusChangeMessage, VacuumError } from '../../../models/index.js';
import { AbstractMessageHandler } from '../../handlers/abstractMessageHandler.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

/** Converts Q10 wire suction power (1–8) to V1 range (101–108). */
function q10FanPowerToV1(wire: number): number {
	return wire + 100;
}

/** Converts Q10 wire water flow (0–3) to V1 range (200–203). */
function q10WaterModeToV1(wire: number): number {
	return wire + 200;
}

/** Converts Q7 'wind' property (1–5) to V1 suction power range. */
function q7WindToV1(wire: number): number {
	switch (wire) {
		case 1:
			return 101;
		case 2:
			return 102;
		case 3:
			return 103;
		case 4:
			return 104;
		case 5:
			return 108;
		default:
			return 105;
	}
}

/** Converts Q7 'water' property (1–3) to V1 water flow range. */
function q7WaterToV1(wire: number): number {
	return wire + 200;
}

/**
 * Handles B01 protocol (Q7/Q10) device status push messages.
 * Q10 sends individual DPS keys (121=state, 122=battery, 123=fan_power, 124=water_mode).
 * Q7 sends a JSON envelope at DPS key 10001 with method 'prop.get' or 'prop.post'.
 */
export class B01StatusListener implements AbstractMessageListener {
	readonly name = 'B01StatusListener';

	private handler: AbstractMessageHandler | undefined;

	private lastBattery = 0;
	private lastChargeStatus = 0;
	private lastState: OperationStatusCode = OperationStatusCode.Unknown;
	private lastSuctionPower = 0;
	private lastWaterFlow = 0;

	constructor(
		public readonly duid: string,
		private readonly logger: AnsiLogger,
	) {}

	public registerHandler(handler: AbstractMessageHandler): void {
		this.handler = handler;
	}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) return;
		if (!this.handler) return;
		if (!message.body) return;

		await this.tryHandleQ10Push(message, this.handler);
		await this.tryHandleQ7Response(message, this.handler);
	}

	private async tryHandleQ10Push(message: ResponseMessage, handler: AbstractMessageHandler): Promise<void> {
		if (!message.body) return;

		const errorCode = message.body.get(Q10RequestCode.error_code);
		if (errorCode !== undefined) {
			await handler.onError(new VacuumError(this.duid, Number(errorCode), DockErrorCode.None, undefined));
		}

		const state = message.body.get(Q10RequestCode.state);
		if (state !== undefined) {
			this.lastState = Number(state);
			const statusMsg = new StatusChangeMessage(
				this.duid,
				this.lastState,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			);
			await handler.onStatusChanged(statusMsg);
		}

		const battery = message.body.get(Q10RequestCode.battery);
		if (battery !== undefined) {
			this.lastBattery = Number(battery);
			const batteryMsg = new BatteryMessage(this.duid, this.lastBattery, this.lastChargeStatus, this.lastState);
			await handler.onBatteryUpdate(batteryMsg);
		}

		const chargeStatus = message.body.get(Q10RequestCode.charge_status);
		if (chargeStatus !== undefined) {
			this.lastChargeStatus = Number(chargeStatus);
			const batteryMsg = new BatteryMessage(this.duid, this.lastBattery, this.lastChargeStatus, this.lastState);
			await handler.onBatteryUpdate(batteryMsg);
		}

		const fanPower = message.body.get(Q10RequestCode.fan_power);
		const waterBoxMode = message.body.get(Q10RequestCode.water_box_mode);

		if (fanPower !== undefined) {
			this.lastSuctionPower = q10FanPowerToV1(Number(fanPower));
		}
		if (waterBoxMode !== undefined) {
			this.lastWaterFlow = q10WaterModeToV1(Number(waterBoxMode));
		}
		if (fanPower !== undefined || waterBoxMode !== undefined) {
			const cleanMode = new CleanModeSetting(this.lastSuctionPower, this.lastWaterFlow, 0, 0, undefined);
			await handler.onCleanModeUpdate(cleanMode);
		}

		const cleanArea = message.body.get(Q10RequestCode.clean_area);
		const cleanTime = message.body.get(Q10RequestCode.clean_time);
		const cleanTaskType = message.body.get(Q10RequestCode.clean_task_type);

		if (cleanArea !== undefined || cleanTime !== undefined || cleanTaskType !== undefined) {
			await handler.onServiceAreaUpdate({
				duid: this.duid,
				state: this.lastState,
				cleaningProcess: {
					clean_area: Number(cleanArea ?? 0),
					clean_time: Number(cleanTime ?? 0),
				},
				cleaningInfo: undefined,
			});
		}
	}

	private async tryHandleQ7Response(message: ResponseMessage, handler: AbstractMessageHandler): Promise<void> {
		if (!message.body) return;

		const raw = message.body.get(Q7RequestCode.query_response);
		if (raw === undefined) return;

		try {
			const parsed: { method?: string; data?: Record<string, unknown> } =
				typeof raw === 'string' ? JSON.parse(raw) : (raw as { method?: string; data?: Record<string, unknown> });

			if (parsed?.method !== Q7RequestMethod.get_prop && parsed?.method !== 'prop.post') return;

			const data = parsed.data ?? {};
			await this.handleQ7Props(data, handler);
		} catch (err: unknown) {
			this.logger.warn(`[${this.duid}] B01StatusListener: failed to parse Q7 query_response: ${String(err)}`);
		}
	}

	private async handleQ7Props(data: Record<string, unknown>, handler: AbstractMessageHandler): Promise<void> {
		if (data['fault'] !== undefined) {
			await handler.onError(new VacuumError(this.duid, Number(data['fault']), DockErrorCode.None, undefined));
		}

		if (data['status'] !== undefined) {
			this.lastState = Number(data['status']);
			const statusMsg = new StatusChangeMessage(
				this.duid,
				this.lastState,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
				undefined,
			);
			await handler.onStatusChanged(statusMsg);
		}

		if (data['quantity'] !== undefined) {
			this.lastBattery = Number(data['quantity']);
			const batteryMsg = new BatteryMessage(this.duid, this.lastBattery, this.lastChargeStatus, this.lastState);
			await handler.onBatteryUpdate(batteryMsg);
		}

		const wind = data['wind'];
		const water = data['water'];

		if (wind !== undefined) {
			this.lastSuctionPower = q7WindToV1(Number(wind));
		}
		if (water !== undefined) {
			this.lastWaterFlow = q7WaterToV1(Number(water));
		}

		const mopRoute = data['clean_path_preference'] !== undefined ? Number(data['clean_path_preference']) : 0;

		if (wind !== undefined || water !== undefined || data['mode'] !== undefined) {
			const cleanMode = new CleanModeSetting(this.lastSuctionPower, this.lastWaterFlow, 0, mopRoute, undefined);
			await handler.onCleanModeUpdate(cleanMode);
		}

		const cleanArea = data['cleaning_area'];
		const cleanTime = data['cleaning_time'];

		if (cleanArea !== undefined || cleanTime !== undefined) {
			await handler.onServiceAreaUpdate({
				duid: this.duid,
				state: this.lastState,
				cleaningProcess: {
					clean_area: Number(cleanArea ?? 0) * 100,
					clean_time: Number(cleanTime ?? 0) * 60,
				},
				cleaningInfo: undefined,
			});
		}
	}
}
