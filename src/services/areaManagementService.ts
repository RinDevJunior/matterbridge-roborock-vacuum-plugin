import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoomIndexMap } from '../model/RoomIndexMap.js';
import { RoborockIoTApi, ClientRouter, RequestMessage, MultipleMap, MapInfo, Scene } from '../roborockCommunication/index.js';
import { DeviceError } from '../errors/index.js';
import { MessageRoutingService } from './index.js';

/** Manages cleaning areas, rooms, maps, and scenes. */
export class AreaManagementService {
  // State management for cleaning areas
  private supportedAreas = new Map<string, ServiceArea.Area[]>();
  private supportedRoutines = new Map<string, ServiceArea.Area[]>();
  private selectedAreas = new Map<string, number[]>();
  private supportedAreaIndexMaps = new Map<string, RoomIndexMap>();
  private iotApi: RoborockIoTApi | undefined;
  private messageClient: ClientRouter | undefined;

  constructor(
    private readonly logger: AnsiLogger,
    private readonly serviceRouting?: MessageRoutingService,
  ) {}

  /** Set IoT API instance. */
  public setIotApi(iotApi: RoborockIoTApi): void {
    this.iotApi = iotApi;
  }

  /** Set message client for device communication. */
  public setMessageClient(messageClient: ClientRouter | undefined): void {
    this.messageClient ??= messageClient;
  }

  /** Set selected cleaning areas, translating IDs via index map. */
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

  /** Get selected cleaning areas for a device. */
  public getSelectedAreas(duid: string): number[] {
    return this.selectedAreas.get(duid) ?? [];
  }

  /** Set supported cleaning areas (rooms). */
  public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
    this.supportedAreas.set(duid, supportedAreas);
  }

  /** Set area-to-room index mapping. */
  public setSupportedAreaIndexMap(duid: string, indexMap: RoomIndexMap): void {
    this.supportedAreaIndexMaps.set(duid, indexMap);
  }

  /** Set supported routines/scenes. */
  public setSupportedScenes(duid: string, routineAsRooms: ServiceArea.Area[]): void {
    this.supportedRoutines.set(duid, routineAsRooms);
  }

  /** Get supported cleaning areas. */
  public getSupportedAreas(duid: string): ServiceArea.Area[] | undefined {
    return this.supportedAreas.get(duid);
  }

  /** Get area index map. */
  public getSupportedAreasIndexMap(duid: string): RoomIndexMap | undefined {
    return this.supportedAreaIndexMaps.get(duid);
  }

  /** Get supported routines/scenes. */
  public getSupportedRoutines(duid: string): ServiceArea.Area[] | undefined {
    return this.supportedRoutines.get(duid);
  }

  /** Get map information for a device. */
  public async getMapInformation(duid: string): Promise<MapInfo | undefined> {
    if (!this.messageClient) {
      throw new DeviceError('Message client not initialized', duid);
    }

    this.logger.debug('AreaManagementService - getMapInformation', duid);
    const isRequestSecure = this.serviceRouting?.getMqttAlwaysOn(duid) ?? false;
    const response = await this.messageClient.get<MultipleMap[] | undefined>(duid, new RequestMessage({ method: 'get_multi_maps_list', secure: isRequestSecure }));

    this.logger.debug('AreaManagementService - getMapInformation response', debugStringify(response ?? []));
    return response ? new MapInfo(response[0]) : undefined;
  }

  /** Get room mappings (2D array of room IDs). */
  public async getRoomMappings(duid: string): Promise<number[][] | undefined> {
    if (!this.messageClient) {
      this.logger.warn('messageClient not initialized. Waiting for next execution');
      return undefined;
    }
    const isRequestSecure = this.serviceRouting?.getMqttAlwaysOn(duid) ?? false;
    return this.messageClient.get(duid, new RequestMessage({ method: 'get_room_mapping', secure: isRequestSecure }));
  }

  /** Get all scenes for a home. */
  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    if (!this.iotApi) {
      throw new DeviceError('IoT API not initialized');
    }

    return this.iotApi.getScenes(homeId);
  }

  /** Start a cleaning scene. */
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
