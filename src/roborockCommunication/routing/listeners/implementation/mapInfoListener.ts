import { AnsiLogger } from 'matterbridge/logger';

import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { RoomMap } from '../../../../core/application/models/RoomMap.js';
import { HomeEntity } from '../../../../core/domain/entities/Home.js';
import { getSupportedAreas } from '../../../../initialData/getSupportedAreas.js';
import { AreaManagementService } from '../../../../services/areaManagementService.js';
import { Q7RequestCode, Q7RequestMethod } from '../../../enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../enums/Q10RequestCode.js';
import { HomeModelMapper, RawRoomMappingData } from '../../../models/home/index.js';
import { MultipleMapDto } from '../../../models/home/MultipleMapDto.js';
import { RoomDto } from '../../../models/home/RoomDto.js';
import { DpsPayload, Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class MapInfoListener implements AbstractMessageListener {
	readonly name = 'MapInfoListener';

	constructor(
		public readonly duid: string,
		private readonly rooms: RoomDto[],
		private readonly areaService: AreaManagementService,
		private readonly logger: AnsiLogger,
	) {}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) return;
		this.tryParseV1MapInfo(message);
		this.tryParseV1RoomMap(message);
		this.tryParseB01MapInfo(message);
		this.tryParseB01RoomMap(message);
	}

	private tryParseV1MapInfo(message: ResponseMessage): void {
		if (!message.body) return;
		let dps = message.get(Protocol.rpc_response) as DpsPayload | undefined;
		if (!dps) dps = message.get(Protocol.general_response) as DpsPayload | undefined;
		if (!dps?.result) return;

		const raw = Array.isArray(dps.result) ? dps.result[0] : dps.result;
		if (!isMultipleMapDto(raw)) return;

		const mapInfo = new MapInfo(raw);
		this.logger.debug(`[${this.duid}] MapInfoListener: V1 map info push received (${mapInfo.maps.length} maps)`);

		if (mapInfo.hasRooms) {
			const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, this.rooms));
			this.updateAreas(new RoomMap(roomMappings), mapInfo);
		}
	}

	private tryParseV1RoomMap(message: ResponseMessage): void {
		if (!message.body) return;
		let dps = message.get(Protocol.rpc_response) as DpsPayload | undefined;
		if (!dps) dps = message.get(Protocol.general_response) as DpsPayload | undefined;
		if (!dps?.result || !isRawRoomMappingData(dps.result)) return;

		this.logger.debug(`[${this.duid}] MapInfoListener: V1 room map push received (${dps.result.length} rooms)`);
		const roomMappings = dps.result
			.map((entry: RawRoomMappingData[number]) => HomeModelMapper.rawArrayToMapRoomDto(entry, 0))
			.map((dto) => HomeModelMapper.toRoomMapping(dto, this.rooms));
		this.updateAreas(new RoomMap(roomMappings), MapInfo.empty());
	}

	private tryParseB01MapInfo(message: ResponseMessage): void {
		if (!message.body) return;
		const data = message.body.get(Q10RequestCode.multimap);
		if (!data) return;
		this.logger.debug(
			`[${this.duid}] MapInfoListener: B01 map info push (key ${Q10RequestCode.multimap}) — TODO: parse once shape confirmed`,
		);
	}

	private tryParseB01RoomMap(message: ResponseMessage): void {
		if (!message.body) return;

		// Q10: flat DPS key 999 (get_prop) — DPS code unverified from device log
		const q10Data = message.body.get(Q10RequestCode.get_prop);
		if (q10Data !== undefined) {
			this.logger.debug(
				`[${this.duid}] MapInfoListener: B01-Q10 room map push (key ${Q10RequestCode.get_prop}) — TODO: parse once shape confirmed`,
			);
			return;
		}

		// Q7: query_response envelope (key 10001)
		const q7Envelope = message.body.get(Q7RequestCode.query_response) as
			| { method?: string; result?: unknown }
			| undefined;
		if (q7Envelope?.method === Q7RequestMethod.get_room_mapping_backup_1 && q7Envelope.result) {
			this.logger.debug(`[${this.duid}] MapInfoListener: B01-Q7 room map push — TODO: parse once shape confirmed`);
		}
	}

	private updateAreas(roomMap: RoomMap, mapInfo: MapInfo): void {
		const homeEntity = new HomeEntity(0, '', roomMap, mapInfo, 0);
		const { supportedAreas, roomIndexMap } = getSupportedAreas(homeEntity, this.logger);
		this.areaService.setSupportedAreaIndexMap(this.duid, roomIndexMap);
		this.areaService.setSupportedAreas(this.duid, supportedAreas);
		this.logger.debug(`[${this.duid}] MapInfoListener: areas updated (${roomMap.rooms.length} rooms)`);
	}
}

function isMultipleMapDto(value: unknown): value is MultipleMapDto {
	return (
		typeof value === 'object' &&
		value !== null &&
		'map_info' in value &&
		Array.isArray((value as MultipleMapDto).map_info)
	);
}

function isRawRoomMappingData(value: unknown): value is RawRoomMappingData {
	return (
		Array.isArray(value) &&
		value.length > 0 &&
		Array.isArray(value[0]) &&
		typeof value[0][0] === 'number' &&
		typeof value[0][1] === 'string'
	);
}
