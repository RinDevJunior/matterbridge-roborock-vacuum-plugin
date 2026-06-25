import { AnsiLogger } from 'matterbridge/logger';

import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { MopRoute, MopWaterFlow } from '../../../behaviors/roborock.vacuum/enums/index.js';
import { MapInfo } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/index.js';
import { MultipleMapDto, RawRoomMappingData } from '../../models/home/index.js';
import { DpsPayload, NetworkInfo, Protocol, RequestMessage, ResponseMessage } from '../../models/index.js';
import { Client } from '../../routing/client.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';

function parseV1Result(msg: ResponseMessage, messageId: number): unknown {
	if (!msg.body) return undefined;

	let dps = msg.get(Protocol.rpc_response) as DpsPayload;
	if (!dps) dps = msg.get(Protocol.general_response) as DpsPayload;
	if (!dps) dps = msg.get(Protocol.general_request) as DpsPayload;

	if (!dps || dps.id !== messageId) return undefined;

	const result = dps.result;
	if (result === undefined || result === null) return undefined;

	return Array.isArray(result) ? result[0] : result;
}

export class V10MessageDispatcher implements AbstractMessageDispatcher {
	public dispatcherName = 'V10MessageDispatcher';
	constructor(
		private readonly logger: AnsiLogger,
		private readonly client: Client,
	) {}

	public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
		const request = new RequestMessage({ method: 'get_network_info' });
		return await this.client.query<NetworkInfo>(
			duid,
			request,
			(msg) => parseV1Result(msg, request.messageId) as NetworkInfo | undefined,
		);
	}

	public async getSerialNumber(duid: string): Promise<string | undefined> {
		const request = new RequestMessage({ method: 'get_serial_number' });
		const response = await this.client.query<{ serial_number: string }[]>(duid, request, (msg) => {
			if (!msg.body) return undefined;
			let dps = msg.get(Protocol.rpc_response) as DpsPayload;
			if (!dps) dps = msg.get(Protocol.general_response) as DpsPayload;
			if (!dps || dps.id !== request.messageId) return undefined;
			return dps.result as { serial_number: string }[];
		});
		return response && response.length > 0 ? response[0].serial_number : duid;
	}

	public async getDeviceStatus(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'get_prop', params: ['get_status'] });
		await this.client.send(duid, request);
	}

	public async getHomeMap(duid: string): Promise<MapRoomResponse> {
		const request = new RequestMessage({ method: 'get_map_v1', secure: true });
		const response = await this.client.query<MapRoomResponse>(
			duid,
			request,
			(msg) => parseV1Result(msg, request.messageId) as MapRoomResponse | undefined,
		);
		return response ?? {};
	}

	public async getMapInfo(duid: string): Promise<MapInfo> {
		const request = new RequestMessage({ method: 'get_multi_maps_list' });
		const response = await this.client.query<MultipleMapDto>(
			duid,
			request,
			(msg) => parseV1Result(msg, request.messageId) as MultipleMapDto | undefined,
		);
		return new MapInfo(response ?? { max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
	}

	public async getMapInfoV2(duid: string): Promise<void> {
		await this.client.send(duid, new RequestMessage({ method: 'get_multi_maps_list' }));
	}

	public async getRoomMap(duid: string, _activeMap: number): Promise<RawRoomMappingData> {
		const request = new RequestMessage({ method: 'get_room_mapping' });
		const response = await this.client.query<RawRoomMappingData>(duid, request, (msg) => {
			if (!msg.body) return undefined;
			let dps = msg.get(Protocol.rpc_response) as DpsPayload;
			if (!dps) dps = msg.get(Protocol.general_response) as DpsPayload;
			if (!dps || dps.id !== request.messageId) return undefined;
			return dps.result as RawRoomMappingData;
		});
		return response ?? [];
	}

	public async getRoomMapV2(duid: string, _activeMap: number): Promise<void> {
		await this.client.send(duid, new RequestMessage({ method: 'get_room_mapping' }));
	}

	public async switchMap(duid: string, mapId: number): Promise<void> {
		await this.client.send(duid, new RequestMessage({ method: 'load_multi_map', params: [mapId] }));
	}

	public async goHome(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'app_charge' });
		await this.client.send(duid, request);
	}

	public async startCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'app_start' });
		await this.client.send(duid, request);
	}

	public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
		const request = new RequestMessage({
			method: 'app_segment_clean',
			params: [{ segments: roomIds, repeat: repeat }],
		});
		await this.client.send(duid, request);
	}

	public async pauseCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'app_pause' });
		await this.client.send(duid, request);
	}

	public async resumeCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'app_resume' });
		await this.client.send(duid, request);
	}

	public async resumeRoomCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'resume_segment_clean' });
		await this.client.send(duid, request);
	}

	public async stopCleaning(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'app_stop' });
		await this.client.send(duid, request);
	}

	public async findMyRobot(duid: string): Promise<void> {
		const request = new RequestMessage({ method: 'find_me' });
		await this.client.send(duid, request);
	}

	public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
		const request = new RequestMessage(def);
		return this.client.send(duid, request);
	}

	public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
		const result = await this.client.query<T>(duid, def, (msg) => parseV1Result(msg, def.messageId) as T | undefined);
		return result as T;
	}

	public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
		const currentMopMode = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_mop_mode' }));
		const suctionPowerRaw = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_custom_mode' }));
		const waterFlowRaw = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_water_box_custom_mode' }));

		let suctionPower: number;
		let waterFlow: number;
		let mopRoute: number;
		let distance_off = 0;

		if (Array.isArray(suctionPowerRaw)) {
			suctionPower = suctionPowerRaw[0];
		} else {
			suctionPower = suctionPowerRaw as number;
		}

		if (Array.isArray(currentMopMode)) {
			mopRoute = currentMopMode[0];
		} else {
			mopRoute = currentMopMode as number;
		}

		if (typeof waterFlowRaw === 'object' && waterFlowRaw !== null && 'water_box_mode' in waterFlowRaw) {
			waterFlow = waterFlowRaw.water_box_mode as number;

			if ('distance_off' in waterFlowRaw) {
				distance_off = (waterFlowRaw.distance_off as number) ?? 0;
			}
		} else {
			waterFlow = waterFlowRaw as number;
		}

		return new CleanModeSetting(suctionPower, waterFlow, distance_off, mopRoute, undefined);
	}

	public async changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void> {
		const { suctionPower, waterFlow, distance_off, mopRoute } = setting;
		this.logger.notice(
			`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`,
		);

		const smartMopRoute = MopRoute.Smart;
		const customMopRoute = MopRoute.Custom;

		if (mopRoute && mopRoute !== smartMopRoute) {
			await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [customMopRoute] }));
		}

		if (suctionPower && suctionPower != 0) {
			await this.client.send(duid, new RequestMessage({ method: 'set_custom_mode', params: [suctionPower] }));
		}

		if (waterFlow && waterFlow == MopWaterFlow.CustomizeWithDistanceOff && distance_off && distance_off != 0) {
			await this.client.send(
				duid,
				new RequestMessage({
					method: 'set_water_box_custom_mode',
					params: { 'water_box_mode': waterFlow, 'distance_off': distance_off },
				}),
			);
		} else if (waterFlow && waterFlow != 0) {
			await this.client.send(duid, new RequestMessage({ method: 'set_water_box_custom_mode', params: [waterFlow] }));
		}

		if (mopRoute && mopRoute != 0) {
			await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [mopRoute] }));
		}
	}
}
