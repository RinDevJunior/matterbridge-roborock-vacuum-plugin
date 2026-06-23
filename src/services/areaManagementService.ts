import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';

import { RoomIndexMap } from '../core/application/models/index.js';
import { DeviceError } from '../errors/index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
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
	private iotApi: RoborockIoTApi | undefined;

	constructor(
		private readonly logger: AnsiLogger,
		private readonly serviceRouting: MessageRoutingService | undefined,
	) {}

	public setIotApi(iotApi: RoborockIoTApi): void {
		this.iotApi = iotApi;
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

	public async getMapInfo(duid: string): Promise<void> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		this.logger.debug('AreaManagementService - getMapInfo', duid);
		await this.serviceRouting.getMapInfo(duid);
	}

	public async getRoomMap(duid: string, activeMap: number): Promise<void> {
		if (!this.serviceRouting) {
			throw new DeviceError('Service routing not initialized', duid);
		}

		this.logger.debug('AreaManagementService - getRoomMap', duid);
		await this.serviceRouting.getRoomMap(duid, activeMap);
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
		this.logger.debug('AreaManagementService - All data cleared');
	}
}
