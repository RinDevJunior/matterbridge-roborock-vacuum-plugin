import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';

import { ROUTINE_MAP_ID } from '../constants/ids.js';
import { MapInfo, RoomIndexMap, RoomMap } from '../core/application/models/index.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { DeviceError } from '../errors/index.js';
import {
	type AreaInfo,
	getSupportedAreas,
	type SegmentInfo,
	type SupportedAreasResult,
	toSupportedMaps,
} from '../initialData/getSupportedAreas.js';
import { mergeSupportedAreasByMap } from '../initialData/mergeSupportedAreasByMap.js';
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
	private progress = new Map<string, ServiceArea.Progress[]>();
	private supportedAreaIndexMaps = new Map<string, RoomIndexMap>();
	private areasListeners = new Map<string, (areas: ServiceArea.Area[], maps: ServiceArea.Map[]) => void>();
	private refreshIntervals = new Map<string, NodeJS.Timeout>();
	private deviceRooms = new Map<string, RoomDto[]>();
	private iotApi: RoborockIoTApi | undefined;
	private mapInfoCache = new Map<string, MapInfo>();
	private v1RoomResolutionCache = new Map<string, { segmentId: number; resolvedAtMs: number }>();

	constructor(
		private readonly logger: AnsiLogger,
		private readonly serviceRouting: MessageRoutingService | undefined,
		private readonly liveMapUpdates = false,
		private readonly enableMultipleMap = true,
	) {}

	private getPrimaryMapId(duid: string): number | undefined {
		return this.mapInfoCache.get(duid)?.maps[0]?.id;
	}

	public isMultipleMapEnabled(): boolean {
		return this.enableMultipleMap;
	}

	public setIotApi(iotApi: RoborockIoTApi): void {
		this.iotApi = iotApi;
	}

	public setDeviceRooms(duid: string, rooms: RoomDto[]): void {
		this.deviceRooms.set(duid, rooms);
	}

	public setSelectedAreas(duid: string, selectedAreas: number[]): void {
		this.logger.debug('AreaManagementService - setSelectedAreas', debugStringify(selectedAreas));
		this.selectedAreas.set(duid, selectedAreas);
	}

	public getSelectedAreas(duid: string): number[] {
		return this.selectedAreas.get(duid) ?? [];
	}

	public setProgress(duid: string, progress: ServiceArea.Progress[]): void {
		this.logger.debug('AreaManagementService - setProgress', debugStringify(progress));
		this.progress.set(duid, progress);
	}

	public getProgress(duid: string): ServiceArea.Progress[] {
		return this.progress.get(duid) ?? [];
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

	public mergeSupportedAreasForMap(
		duid: string,
		mapId: number,
		incomingAreas: ServiceArea.Area[],
		incomingIndexMap: RoomIndexMap,
	): void {
		const existingAreas = this.getSupportedAreas(duid);
		const existingIndexMap = this.getSupportedAreasIndexMap(duid);
		const { supportedAreas, roomIndexMap } = mergeSupportedAreasByMap(
			existingAreas,
			incomingAreas,
			mapId,
			existingIndexMap,
			incomingIndexMap,
		);
		this.setSupportedAreaIndexMap(duid, roomIndexMap);
		this.setSupportedAreas(duid, supportedAreas);
	}

	public getSupportedRoutines(duid: string): ServiceArea.Area[] | undefined {
		return this.supportedRoutines.get(duid);
	}

	private async fetchAndApplyMapInfo(duid: string): Promise<MapInfo | undefined> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		const mapInfo = await this.serviceRouting.getMapInfo(duid);
		this.mapInfoCache.set(duid, mapInfo);
		if (mapInfo.hasRooms) {
			const rooms = this.deviceRooms.get(duid) ?? [];
			const roomMappings = mapInfo.allRooms.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
			const homeEntity = new HomeEntity(0, '', new RoomMap(roomMappings), mapInfo, 0);
			this.applyAreasResult(duid, getSupportedAreas(homeEntity, this.logger, this.enableMultipleMap));
		} else if (mapInfo.maps.length > 0) {
			this.setSupportedMaps(duid, toSupportedMaps(mapInfo, this.enableMultipleMap));
		}
		return mapInfo;
	}

	private applyAreasResult(duid: string, result: SupportedAreasResult, mergeMapId?: number): void {
		this.setSupportedMaps(duid, result.supportedMaps);
		if (this.enableMultipleMap && mergeMapId !== undefined) {
			this.mergeSupportedAreasForMap(duid, mergeMapId, result.supportedAreas, result.roomIndexMap);
			return;
		}
		this.setSupportedAreaIndexMap(duid, result.roomIndexMap);
		this.setSupportedAreas(duid, result.supportedAreas);
	}

	/** Publish areas/maps from a computed {@link SupportedAreasResult} (live push path). */
	public applySupportedAreasResult(duid: string, result: SupportedAreasResult, mergeMapId?: number): void {
		this.applyAreasResult(duid, result, mergeMapId);
	}

	private isPhysicalMapId(mapId: number): boolean {
		return mapId >= 0 && mapId !== ROUTINE_MAP_ID;
	}

	private hasAreasForMap(duid: string, mapId: number): boolean {
		return this.getSupportedAreas(duid).some((a) => a.mapId === mapId);
	}

	private applyRoomMapData(duid: string, rawData: RawRoomMappingData, expectedMapId?: number): number | undefined {
		if (!rawData || rawData.length === 0) {
			return undefined;
		}

		const storedMapInfo = this.mapInfoCache.get(duid) ?? MapInfo.empty();
		const resolvedMapId = storedMapInfo.resolveMapIdForRoomData(rawData, expectedMapId);

		if (!this.enableMultipleMap) {
			const primaryMapId = this.getPrimaryMapId(duid);
			if (primaryMapId !== undefined && resolvedMapId !== primaryMapId) {
				return undefined;
			}
		}

		const rooms = this.deviceRooms.get(duid) ?? [];
		const roomMappings = HomeModelMapper.rawRoomDataToRoomMappings(rawData, resolvedMapId, storedMapInfo, rooms);
		const homeEntity = new HomeEntity(0, '', new RoomMap(roomMappings), storedMapInfo, 0);
		this.applyAreasResult(
			duid,
			getSupportedAreas(homeEntity, this.logger, this.enableMultipleMap),
			this.enableMultipleMap ? resolvedMapId : undefined,
		);
		return resolvedMapId;
	}

	private async fetchAndApplyRoomMap(
		duid: string,
		activeMap: number,
		expectedMapId?: number,
	): Promise<number | undefined> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		const rawData = await this.serviceRouting.getRoomMap(duid, activeMap);
		return this.applyRoomMapData(duid, rawData, expectedMapId);
	}

	public async ensureAreasForMap(duid: string, mapId: number, options?: { switchFirst?: boolean }): Promise<boolean> {
		if (!this.isPhysicalMapId(mapId)) {
			return true;
		}
		if (!this.enableMultipleMap) {
			const primaryMapId = this.getPrimaryMapId(duid);
			if (primaryMapId !== undefined && mapId !== primaryMapId) {
				return this.hasAreasForMap(duid, mapId);
			}
		}
		if (this.hasAreasForMap(duid, mapId)) {
			return true;
		}

		try {
			if (options?.switchFirst === true && this.serviceRouting) {
				await this.serviceRouting.switchMap(duid, mapId);
			}
			await this.fetchAndApplyRoomMap(duid, mapId, mapId);
		} catch (err) {
			this.logger.error(`AreaManagementService - ensureAreasForMap failed for ${duid} map ${mapId}: ${String(err)}`);
			return false;
		}

		return this.hasAreasForMap(duid, mapId);
	}

	public async getMapInfo(duid: string): Promise<MapInfo | undefined> {
		this.logger.debug('AreaManagementService - getMapInfo', duid);
		if (this.liveMapUpdates) {
			if (!this.serviceRouting) {
				throw new DeviceError('Service routing not initialized', duid);
			}
			await this.serviceRouting.getMapInfoV2(duid);
			return undefined;
		}
		return this.fetchAndApplyMapInfo(duid);
	}

	public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData | undefined> {
		this.logger.debug('AreaManagementService - getRoomMap', duid);
		if (this.liveMapUpdates) {
			if (!this.serviceRouting) {
				throw new DeviceError('Service routing not initialized', duid);
			}
			await this.serviceRouting.getRoomMapV2(duid, activeMap);
			return undefined;
		}
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}
		const rawData = await this.serviceRouting.getRoomMap(duid, activeMap);
		this.applyRoomMapData(duid, rawData);
		return rawData;
	}

	public async resolveInitialAreas(
		duid: string,
	): Promise<{ supportedAreas: ServiceArea.Area[]; supportedMaps: ServiceArea.Map[] }> {
		this.logger.debug('AreaManagementService - resolveInitialAreas', duid);

		try {
			const mapInfo = await this.fetchAndApplyMapInfo(duid);
			const originalActiveMapId = await this.fetchAndApplyRoomMap(duid, -1);

			if (this.enableMultipleMap && mapInfo && this.serviceRouting) {
				for (const map of mapInfo.maps) {
					if (!this.isPhysicalMapId(map.id)) {
						continue;
					}
					if (this.hasAreasForMap(duid, map.id)) {
						continue;
					}
					await this.ensureAreasForMap(duid, map.id, { switchFirst: true });
				}

				if (originalActiveMapId !== undefined && this.isPhysicalMapId(originalActiveMapId)) {
					try {
						await this.serviceRouting.switchMap(duid, originalActiveMapId);
					} catch (err) {
						this.logger.warn(
							`AreaManagementService - resolveInitialAreas failed to restore active map ${originalActiveMapId} for ${duid}: ${String(err)}`,
						);
					}
				}

				this.sortSupportedAreasByMap(duid);
			}
		} catch (err) {
			this.logger.error(`AreaManagementService - resolveInitialAreas failed for ${duid}: ${String(err)}`);
		}

		const supportedAreas = this.getSupportedAreas(duid);
		const supportedMaps = this.getSupportedMaps(duid);

		return { supportedAreas, supportedMaps };
	}

	private sortSupportedAreasByMap(duid: string): void {
		const existingAreas = this.getSupportedAreas(duid);
		const existingIndexMap = this.getSupportedAreasIndexMap(duid);

		const indexedAreas = existingAreas.map((area, oldAreaId) => ({ area, oldAreaId }));
		const sortedIndexedAreas = [...indexedAreas].sort((a, b) => (a.area.mapId ?? 0) - (b.area.mapId ?? 0));

		const sortedAreas = sortedIndexedAreas.map(({ area }, newAreaId) => ({ ...area, areaId: newAreaId }));

		const areaInfos = new Map<number, AreaInfo>();
		const roomInfos = new Map<string, SegmentInfo>();

		sortedIndexedAreas.forEach(({ oldAreaId }, newAreaId) => {
			const info = existingIndexMap?.areaInfo.get(oldAreaId);
			if (!info) {
				return;
			}
			areaInfos.set(newAreaId, info);
			const mapId = info.mapId ?? 0;
			roomInfos.set(`${info.roomId}-${mapId}`, {
				areaId: newAreaId,
				mapId,
				roomName: info.roomName,
			});
		});

		const sortedIndexMap = new RoomIndexMap(areaInfos, roomInfos);
		this.setSupportedAreaIndexMap(duid, sortedIndexMap);
		this.setSupportedAreas(duid, sortedAreas);
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

	public setV1ResolvedSegment(duid: string, segmentId: number): void {
		this.v1RoomResolutionCache.set(duid, { segmentId, resolvedAtMs: Date.now() });
	}

	public getV1ResolvedSegment(duid: string, maxAgeMs = 30_000): number | undefined {
		const cached = this.v1RoomResolutionCache.get(duid);
		if (!cached) return undefined;
		if (Date.now() - cached.resolvedAtMs > maxAgeMs) return undefined;
		return cached.segmentId;
	}

	public async requestV1MapRefresh(duid: string): Promise<void> {
		if (!this.serviceRouting) return;
		try {
			await this.serviceRouting.requestHomeMapPush(duid);
		} catch (err: unknown) {
			this.logger.debug(`[${duid}] requestV1MapRefresh failed: ${err instanceof Error ? err.message : String(err)}`);
		}
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
		this.progress.clear();
		this.supportedAreaIndexMaps.clear();
		this.areasListeners.clear();
		this.deviceRooms.clear();
		this.mapInfoCache.clear();
		this.v1RoomResolutionCache.clear();
		this.logger.debug('AreaManagementService - All data cleared');
	}
}
