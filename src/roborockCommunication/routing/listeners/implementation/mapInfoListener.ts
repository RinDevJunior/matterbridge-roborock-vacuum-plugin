import { AnsiLogger } from 'matterbridge/logger';

import { MapInfo } from '../../../../core/application/models/MapInfo.js';
import { RoomMap } from '../../../../core/application/models/RoomMap.js';
import { HomeEntity } from '../../../../core/domain/entities/Home.js';
import { getSupportedAreas } from '../../../../initialData/getSupportedAreas.js';
import { ProtocolVersion } from '../../../../roborockCommunication/enums/protocolVersion.js';
import { B01MapParser } from '../../../../roborockCommunication/map/b01/b01MapParser.js';
import { AreaManagementService } from '../../../../services/areaManagementService.js';
import { Q7RequestCode, Q7RequestMethod } from '../../../enums/Q7RequestCode.js';
import { Q10RequestCode } from '../../../enums/Q10RequestCode.js';
import { HomeModelMapper, RawRoomMappingData } from '../../../models/home/index.js';
import { MapDataDto } from '../../../models/home/MapDataDto.js';
import { MultipleMapDto } from '../../../models/home/MultipleMapDto.js';
import { RoomDto } from '../../../models/home/RoomDto.js';
import { DpsPayload, Protocol, ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class MapInfoListener implements AbstractMessageListener {
	readonly name = 'MapInfoListener';
	readonly requiresBody = true;

	private readonly b01MapParser = new B01MapParser();
	private pendingB01MapInfo: MapInfo | undefined;

	constructor(
		public readonly duid: string,
		private readonly rooms: RoomDto[],
		private readonly areaService: AreaManagementService,
		private readonly logger: AnsiLogger,
		private readonly deviceModel?: string,
		private readonly deviceSerial?: string,
		private readonly onActiveMapChanged?: (mapId: number) => void,
		private readonly deviceProtocol?: string,
		private readonly allowV1AreaUpdate: boolean = true,
	) {}

	public async onMessage(message: ResponseMessage): Promise<void> {
		if (message.duid !== this.duid) return;
		this.tryParseV1MapInfo(message);
		this.tryParseV1RoomMap(message);
		this.tryParseB01MapInfo(message);
		this.tryParseB01RoomMap(message);
		this.tryParseB01MapBinary(message);
	}

	private tryParseV1MapInfo(message: ResponseMessage): void {
		if (!this.allowV1AreaUpdate) return;
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
		if (!this.allowV1AreaUpdate) return;
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
		const raw = message.body.get(Q10RequestCode.multimap) as { data?: unknown } | undefined;
		if (!raw?.data || !Array.isArray(raw.data)) return;

		const mapDataDtos: MapDataDto[] = (raw.data as { mapFlag?: number; id?: number; name?: string }[]).map((entry) => ({
			mapFlag: entry.mapFlag ?? entry.id ?? 0,
			add_time: 0,
			length: 0,
			name: entry.name ?? '',
			bak_maps: [],
			rooms: [],
		}));

		const multimap: MultipleMapDto = {
			max_multi_map: mapDataDtos.length,
			max_bak_map: 0,
			multi_map_count: mapDataDtos.length,
			map_info: mapDataDtos,
		};

		this.pendingB01MapInfo = new MapInfo(multimap);
		this.logger.debug(`[${this.duid}] MapInfoListener: B01 multimap push — ${this.pendingB01MapInfo.maps.length} maps`);

		const supportedMaps = this.pendingB01MapInfo.maps.map((m) => ({ mapId: m.id, name: m.name ?? `Map ${m.id}` }));
		this.areaService.setSupportedMaps(this.duid, supportedMaps);
	}

	private tryParseB01RoomMap(message: ResponseMessage): void {
		if (!message.body) return;

		const raw = message.body.get(Q7RequestCode.query_response);
		if (raw === undefined) return;

		try {
			const parsed: { method?: string; data?: unknown } =
				typeof raw === 'string' ? JSON.parse(raw) : (raw as { method?: string; data?: unknown });

			if (parsed?.method !== Q7RequestMethod.get_map_list) return;

			const mapList = (parsed.data as { map_list?: { id: number; name: string; cur?: boolean }[] })?.map_list;
			if (!mapList || !Array.isArray(mapList)) return;

			const mapDataDtos: MapDataDto[] = mapList.map((m) => ({
				mapFlag: m.id,
				add_time: 0,
				length: 0,
				name: m.name ?? '',
				bak_maps: [],
				rooms: [],
			}));

			this.pendingB01MapInfo = new MapInfo({
				max_multi_map: mapDataDtos.length,
				max_bak_map: 0,
				multi_map_count: mapDataDtos.length,
				map_info: mapDataDtos,
			});

			this.logger.debug(`[${this.duid}] MapInfoListener: B01-Q7 map list push — ${mapList.length} maps`);
			const supportedMaps = this.pendingB01MapInfo.maps.map((m) => ({ mapId: m.id, name: m.name ?? `Map ${m.id}` }));
			this.areaService.setSupportedMaps(this.duid, supportedMaps);

			const activeMap = mapList.find((m) => m.cur === true);
			if (activeMap) {
				this.onActiveMapChanged?.(activeMap.id);
			}
		} catch (err: unknown) {
			this.logger.warn(`[${this.duid}] MapInfoListener: failed to parse B01-Q7 query_response: ${String(err)}`);
		}
	}

	private tryParseB01MapBinary(message: ResponseMessage): void {
		if (!message.body) return;
		const mapBuffer = message.body.get(Protocol.map_response);
		if (!mapBuffer || !Buffer.isBuffer(mapBuffer)) return;
		if (this.deviceProtocol === ProtocolVersion.V1) return;

		const modelShortCode = this.deviceModel?.split('.').at(-1);
		if (!modelShortCode || !this.deviceSerial) {
			this.logger.warn(
				`[${this.duid}] MapInfoListener: B01 map binary received but missing model/serial for decryption`,
			);
			return;
		}

		try {
			const b01Info = this.b01MapParser.parseRoomsFromEncryptedBinary(mapBuffer, modelShortCode, this.deviceSerial);
			if (b01Info.rooms.length === 0) {
				this.logger.debug(`[${this.duid}] MapInfoListener: B01 map binary has no rooms`);
				return;
			}

			const roomMappings = b01Info.rooms.map((r) => ({
				id: r.roomId,
				iot_name_id: String(r.roomId),
				tag: r.colorId ?? 0,
				iot_map_id: 0,
				iot_name: r.roomName || this.rooms.find((rd) => rd.id === r.roomId)?.name || `Room ${r.roomId}`,
			}));

			const mapInfo = this.pendingB01MapInfo ?? MapInfo.empty();
			this.logger.debug(`[${this.duid}] MapInfoListener: B01 map binary parsed — ${b01Info.rooms.length} rooms`);
			this.updateAreas(new RoomMap(roomMappings), mapInfo);

			if (b01Info.mapId !== undefined) {
				this.onActiveMapChanged?.(b01Info.mapId);
			}
		} catch (err: unknown) {
			this.logger.warn(`[${this.duid}] MapInfoListener: failed to parse B01 map binary: ${String(err)}`);
		}
	}

	private updateAreas(roomMap: RoomMap, mapInfo: MapInfo): void {
		const homeEntity = new HomeEntity(0, '', roomMap, mapInfo, 0);
		const { supportedAreas, supportedMaps, roomIndexMap } = getSupportedAreas(homeEntity, this.logger);
		this.areaService.setSupportedAreaIndexMap(this.duid, roomIndexMap);
		this.areaService.setSupportedMaps(this.duid, supportedMaps);
		this.areaService.setSupportedAreas(this.duid, supportedAreas);
		this.logger.debug(
			`[${this.duid}] MapInfoListener: areas updated (${roomMap.rooms.length} rooms, ${supportedMaps.length} maps)`,
		);
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
