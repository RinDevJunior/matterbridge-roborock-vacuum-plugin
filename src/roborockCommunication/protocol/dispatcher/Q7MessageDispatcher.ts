import { randomInt } from 'node:crypto';

import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { MapInfo } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/device.js';
import {
	Q7CleanType,
	Q7ControlCode,
	Q7PropRequestCode,
	Q7RequestCode,
	Q7RequestMethod,
} from '../../enums/Q7RequestCode.js';
import { B01VacuumModeResolver } from '../../helper/B01VacuumModeResolver.js';
import { RawRoomMappingData } from '../../models/home/index.js';
import { NetworkInfo } from '../../models/index.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { Client } from '../../routing/client.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';

export class Q7MessageDispatcher implements AbstractMessageDispatcher {
	public dispatcherName = 'Q7MessageDispatcher';
	public readonly supportsMapQueryResponse = false;
	private lastB01Id: number;

	private get messageId() {
		let tmpMessageId = Date.now();
		if (tmpMessageId <= this.lastB01Id) {
			tmpMessageId = this.lastB01Id + 1;
		}
		this.lastB01Id = tmpMessageId;

		return this.lastB01Id;
	}

	constructor(
		private readonly logger: AnsiLogger,
		private readonly client: Client,
	) {
		this.lastB01Id = Date.now();
	}

	public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
		// Q7 does not support getting network info, or maybe I just haven't found the right command yet.
		return undefined;
	}

	public async getSerialNumber(duid: string): Promise<string | undefined> {
		return duid;
	}

	public getDeviceStatus(duid: string): Promise<void> {
		const request = new RequestMessage({
			dps: this.createDps(Q7RequestMethod.get_prop, {
				property: [
					Q7PropRequestCode.status,
					Q7PropRequestCode.fault,
					Q7PropRequestCode.sweep_type,
					Q7PropRequestCode.mode,
					Q7PropRequestCode.wind,
					Q7PropRequestCode.water,
					Q7PropRequestCode.clean_path_preference,
					Q7PropRequestCode.quantity,
					Q7PropRequestCode.cleaning_time,
					Q7PropRequestCode.cleaning_area,
					Q7PropRequestCode.clean_finish,
				],
			}),
		});
		return this.client.send(duid, request);
	}

	// #region Core Data Retrieval
	public async getHomeMap(duid: string): Promise<MapRoomResponse> {
		return {};
	}

	public async getMapInfo(duid: string): Promise<MapInfo> {
		await this.client.send(
			duid,
			new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_map_list, {}) }),
		);
		return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
	}

	public getMapInfoV2(duid: string): Promise<void> {
		return this.client.send(
			duid,
			new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_map_list, {}) }),
		);
	}

	public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
		await this.client.send(
			duid,
			new RequestMessage({
				messageId: this.messageId,
				dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }),
			}),
		);
		return [];
	}

	public getRoomMapV2(duid: string, activeMap: number): Promise<void> {
		return this.client.send(
			duid,
			new RequestMessage({
				messageId: this.messageId,
				dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }),
			}),
		);
	}

	public async switchMap(duid: string, mapId: number): Promise<void> {
		await this.client.send(
			duid,
			new RequestMessage({
				messageId: this.messageId,
				dps: this.createDps(Q7RequestMethod.set_cur_map, { map_id: mapId }),
			}),
		);
	}

	// #endregion Core Data Retrieval

	// #region Cleaning Commands
	public goHome(duid: string): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.app_charge, {}),
		});
		return this.client.send(duid, request);
	}

	public async startCleaning(duid: string): Promise<void> {
		await this.startRoomCleaning(duid, [], 1);
	}

	public startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.app_start_stop, {
				clean_type: Q7CleanType.room_clean,
				ctrl_value: Q7ControlCode.start,
				room_ids: roomIds,
			}),
		});
		return this.client.send(duid, request);
	}

	public pauseCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.app_start_stop, {
				clean_type: Q7CleanType.full_clean,
				ctrl_value: Q7ControlCode.pause,
				room_ids: [],
			}),
		});
		return this.client.send(duid, request);
	}

	public async resumeCleaning(duid: string): Promise<void> {
		await this.startCleaning(duid);
	}

	public async resumeRoomCleaning(duid: string): Promise<void> {
		await this.startRoomCleaning(duid, [], 1);
	}

	public stopCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.app_start_stop, {
				clean_type: Q7CleanType.full_clean,
				ctrl_value: Q7ControlCode.stop,
				room_ids: [],
			}),
		});
		return this.client.send(duid, request);
	}

	public findMyRobot(duid: string): Promise<void> {
		const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.find_me, {}) });
		return this.client.send(duid, request);
	}

	public sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
		const request = new RequestMessage({ ...def, messageId: this.messageId });
		return this.client.send(duid, request);
	}

	public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
		const request = new RequestMessage({ ...def, messageId: this.messageId });
		const result = await this.client.query<T>(duid, request, (msg) => {
			if (!msg.body) return undefined;
			const data = msg.body.data;
			if (!data) return undefined;
			const values = Object.values(data);
			return values.length > 0 ? (values[0] as T) : undefined;
		});
		return result as T;
	}

	public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
		return new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist); // TODO: Implement retrieval of clean mode data for Q7
	}

	public async changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void> {
		const { suctionPower, waterFlow, distance_off, mopRoute } = setting;
		this.logger?.notice(
			`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`,
		);
		await this.setCleanMode(duid, suctionPower, waterFlow);
		if (suctionPower !== 0) {
			await this.setVacuumMode(duid, suctionPower);
		}
		if (waterFlow !== 0) {
			await this.setMopMode(duid, waterFlow);
		}
	}
	// #endregion Cleaning Commands

	// #region Private Helpers
	private createDps(method: string, params: unknown): Record<number, unknown> {
		const messageId = randomInt(100000000000, 999999999999).toString();
		return { [Q7RequestCode.query]: { msgId: messageId, method: method, params: params } };
	}

	private setCleanMode(duid: string, suctionPower: number, waterFlow: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.set_prop, {
				'mode': B01VacuumModeResolver.resolveQ7CleanMode(suctionPower, waterFlow),
			}),
		});
		return this.client.send(duid, request);
	}

	private setVacuumMode(duid: string, suctionPower: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.set_prop, { 'wind': B01VacuumModeResolver.resolveVacuumMode(suctionPower) }),
		});
		return this.client.send(duid, request);
	}

	private setMopMode(duid: string, waterFlow: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.set_prop, { 'water': B01VacuumModeResolver.resolveMopMode(waterFlow) }),
		});
		return this.client.send(duid, request);
	}

	public setCleanRoute(duid: string, mopRoute: number): Promise<void> {
		const request = new RequestMessage({
			messageId: this.messageId,
			dps: this.createDps(Q7RequestMethod.set_prop, {
				'clean_path_preference': B01VacuumModeResolver.resolveCleanRoute(mopRoute),
			}),
		});
		return this.client.send(duid, request);
	}
	// #endregion Private Helpers
}
