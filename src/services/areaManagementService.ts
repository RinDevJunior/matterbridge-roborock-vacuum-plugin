import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';

import { MapInfo, RoomIndexMap, RoomMap } from '../core/application/models/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { DeviceError } from '../errors/index.js';
import { getSupportedAreas } from '../initialData/getSupportedAreas.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { HomeModelMapper, RawRoomMappingData, RoomDto } from '../roborockCommunication/models/home/index.js';
import { Scene } from '../roborockCommunication/models/index.js';
import { MessageRoutingService } from './index.js';

/** Manages cleaning areas, rooms, maps, and scenes. */
export class AreaManagementService {
	private supportedAreas = new Map<string, ServiceArea.Area[]>();
	private supportedMaps = new Map<string, ServiceArea.Map[]>();
	private supportedRoutines = new Map<string, ServiceArea.Area[]>();
	private selectedAreas = new Map<string, number[]>();
	private supportedAreaIndexMaps = new Map<string, RoomIndexMap>();
	private areasListeners = new Map<string, (areas: ServiceArea.Area[], maps: ServiceArea.Map[]) => void>();
	private refreshIntervals = new Map<string, NodeJS.Timeout>();
	private deviceRooms = new Map<string, RoomDto[]>();
	private iotApi: RoborockIoTApi | undefined;

	constructor(
		private readonly logger: AnsiLogger,
		private readonly serviceRouting: MessageRoutingService | undefined,
		private readonly liveMapUpdates = false,
	) {}

	public setIotApi(iotApi: RoborockIoTApi): void {
		this.iotApi = iotApi;
	}

	public setDeviceRooms(duid: string, rooms: RoomDto[]): void {
		this.deviceRooms.set(duid, rooms);
	}

	public setSelectedAreas(duid: string, selectedAreas: number[]): void {
		this.logger.debug('AreaManagementService - setSelectedAreas', selectedAreas);
		this.selectedAreas.set(duid, selectedAreas);
	}

	public getSelectedAreas(duid: string): number[] {
		return this.selectedAreas.get(duid) ?? [];
	}

	public registerAreasListener(
		duid: string,
		callback: (areas: ServiceArea.Area[], maps: ServiceArea.Map[]) => void,
	): void {
		this.areasListeners.set(duid, callback);
	}

	public setSupportedMaps(duid: string, maps: ServiceArea.Map[]): void {
		this.supportedMaps.set(duid, maps);
	}

	public getSupportedMaps(duid: string): ServiceArea.Map[] {
		return this.supportedMaps.get(duid) ?? [];
	}

	public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
		this.supportedAreas.set(duid, supportedAreas);
		const maps = this.supportedMaps.get(duid) ?? [];
		this.areasListeners.get(duid)?.(supportedAreas, maps);
	}

	public setSupportedAreaIndexMap(duid: string, indexMap: RoomIndexMap): void {
		this.supportedAreaIndexMaps.set(duid, indexMap);
	}

	public setSupportedRoutines(duid: string, routineAsRooms: ServiceArea.Area[]): void {
		this.supportedRoutines.set(duid, routineAsRooms);
	}

	public getSupportedAreas(duid: string): ServiceArea.Area[] {
		return this.supportedAreas.get(duid) ?? [];
	}

	public getSupportedAreasIndexMap(duid: string): RoomIndexMap | undefined {
		return this.supportedAreaIndexMaps.get(duid);
	}

	public getSupportedRoutines(duid: string): ServiceArea.Area[] | undefined {
		return this.supportedRoutines.get(duid);
	}

	public async getMapInfo(duid: string): Promise<MapInfo | undefined> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		this.logger.debug('AreaManagementService - getMapInfo', duid);
		const useLiveMapInfo =
			this.liveMapUpdates || !this.serviceRouting.getMessageDispatcher(duid).supportsMapQueryResponse;
		if (useLiveMapInfo) {
			await this.serviceRouting.getMapInfoV2(duid);
			return undefined;
		}
		const mapInfo = await this.serviceRouting.getMapInfo(duid);
		if (mapInfo.maps.length > 0) {
			const supportedMaps = mapInfo.maps.map((map) => ({
				mapId: map.id,
				name: map.name ?? `Map ${map.id}`,
			}));
			this.setSupportedMaps(duid, supportedMaps);
		}
		return mapInfo;
	}

	public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData | undefined> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		this.logger.debug('AreaManagementService - getRoomMap', duid);
		const useLiveRoomMap =
			this.liveMapUpdates || !this.serviceRouting.getMessageDispatcher(duid).supportsMapQueryResponse;
		if (useLiveRoomMap) {
			await this.serviceRouting.getRoomMapV2(duid, activeMap);
			return undefined;
		}
		const rawData = await this.serviceRouting.getRoomMap(duid, activeMap);
		if (rawData && rawData.length > 0) {
			const rooms = this.deviceRooms.get(duid) ?? [];
			const roomMappings = rawData
				.map((entry) => HomeModelMapper.rawArrayToMapRoomDto(entry, 0))
				.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
			const homeEntity = new HomeEntity(0, '', new RoomMap(roomMappings), MapInfo.empty(), 0);
			const { supportedAreas, roomIndexMap } = getSupportedAreas(homeEntity, this.logger);
			this.setSupportedAreaIndexMap(duid, roomIndexMap);
			this.setSupportedAreas(duid, supportedAreas);
		}
		return rawData;
	}

	public startPeriodicRefresh(duid: string, intervalMs = 5 * 60 * 1000): void {
		this.stopPeriodicRefresh(duid);
		const handle = setInterval(() => {
			this.logger.debug(`AreaManagementService - periodic area refresh for ${duid}`);
			this.getMapInfo(duid).catch((err: unknown) => {
				this.logger.error(`AreaManagementService - getMapInfo refresh failed for ${duid}: ${String(err)}`);
			});
		}, intervalMs);
		this.refreshIntervals.set(duid, handle);
	}

	public stopPeriodicRefresh(duid: string): void {
		const handle = this.refreshIntervals.get(duid);
		if (handle) {
			clearInterval(handle);
			this.refreshIntervals.delete(duid);
		}
	}

	public async getScenes(homeId: number): Promise<Scene[] | undefined> {
		if (!this.iotApi) {
			throw new DeviceError('IoT API not initialized');
		}

		return this.iotApi.getScenes(homeId);
	}

	public async startScene(sceneId: number): Promise<unknown> {
		if (!this.iotApi) {
			throw new DeviceError('IoT API not initialized');
		}

		return this.iotApi.startScene(sceneId);
	}

	/** Clear all area management data and stop all refresh timers. */
	public clearAll(): void {
		for (const duid of this.refreshIntervals.keys()) {
			this.stopPeriodicRefresh(duid);
		}
		this.supportedAreas.clear();
		this.supportedMaps.clear();
		this.supportedRoutines.clear();
		this.selectedAreas.clear();
		this.supportedAreaIndexMaps.clear();
		this.areasListeners.clear();
		this.deviceRooms.clear();
		this.logger.debug('AreaManagementService - All data cleared');
	}
}
