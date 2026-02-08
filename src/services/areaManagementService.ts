import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { DeviceError } from '../errors/index.js';
import { MessageRoutingService } from './index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { RawRoomMappingData, Scene } from '../roborockCommunication/models/index.js';
import { MapInfo, RoomIndexMap } from '../core/application/models/index.js';

/** Manages cleaning areas, rooms, maps, and scenes. */
export class AreaManagementService {
  private supportedAreas = new Map<string, ServiceArea.Area[]>();
  private supportedRoutines = new Map<string, ServiceArea.Area[]>();
  private selectedAreas = new Map<string, number[]>();
  private supportedAreaIndexMaps = new Map<string, RoomIndexMap>();
  private iotApi: RoborockIoTApi | undefined;
  private messageClient: ClientRouter | undefined;

  constructor(
    private readonly logger: AnsiLogger,
    private readonly serviceRouting: MessageRoutingService | undefined,
  ) {}

  public setIotApi(iotApi: RoborockIoTApi): void {
    this.iotApi = iotApi;
  }

  public setMessageClient(messageClient: ClientRouter | undefined): void {
    this.messageClient ??= messageClient;
  }

  public setSelectedAreas(duid: string, selectedAreas: number[]): void {
    this.logger.debug('AreaManagementService - setSelectedAreas', selectedAreas);

    const indexMap = this.supportedAreaIndexMaps.get(duid);
    if (!indexMap) {
      this.logger.warn('No area index map found for device', duid);
      this.selectedAreas.set(duid, []);
      return;
    }

    const roomIds = selectedAreas.map((areaId) => indexMap.getRoomId(areaId)).filter((id) => id !== undefined);

    this.logger.debug('AreaManagementService - setSelectedAreas - roomIds', roomIds);
    this.selectedAreas.set(duid, roomIds);
  }

  public getSelectedAreas(duid: string): number[] {
    return this.selectedAreas.get(duid) ?? [];
  }

  public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
    this.supportedAreas.set(duid, supportedAreas);
  }

  public setSupportedAreaIndexMap(duid: string, indexMap: RoomIndexMap): void {
    this.supportedAreaIndexMaps.set(duid, indexMap);
  }

  public setSupportedScenes(duid: string, routineAsRooms: ServiceArea.Area[]): void {
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

  public async getMapInfo(duid: string): Promise<MapInfo> {
    if (!this.serviceRouting) {
      throw new DeviceError('Service routing not initialized', duid);
    }

    this.logger.debug('AreaManagementService - getMapInfo', duid);
    return this.serviceRouting.getMapInfo(duid);
  }

  public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    if (!this.serviceRouting) {
      throw new DeviceError('Service routing not initialized', duid);
    }

    this.logger.debug('AreaManagementService - getRoomMap', duid);
    return this.serviceRouting.getRoomMap(duid, activeMap);
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

  /** Clear all area management data. */
  public clearAll(): void {
    this.supportedAreas.clear();
    this.supportedRoutines.clear();
    this.selectedAreas.clear();
    this.supportedAreaIndexMaps.clear();
    this.logger.debug('AreaManagementService - All data cleared');
  }
}
