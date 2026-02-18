import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { DeviceError } from '../errors/index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { RawRoomMappingData, RequestMessage } from '../roborockCommunication/models/index.js';
import { AbstractMessageDispatcher } from '../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MapInfo } from '../core/application/models/index.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';

export class MessageRoutingService {
  private messageDispatcherMap = new Map<string, AbstractMessageDispatcher>();

  constructor(
    private readonly logger: AnsiLogger,
    private iotApi?: RoborockIoTApi,
  ) {}

  /** Set IoT API instance. */
  public setIotApi(iotApi: RoborockIoTApi): void {
    this.iotApi = iotApi;
  }

  public registerMessageDispatcher(duid: string, messageDispatcher: AbstractMessageDispatcher): void {
    this.messageDispatcherMap.set(duid, messageDispatcher);
  }

  public getMessageDispatcher(duid: string): AbstractMessageDispatcher {
    const messageDispatcher = this.messageDispatcherMap.get(duid);
    if (!messageDispatcher) {
      throw new DeviceError(`MessageDispatcher not initialized for device ${duid}`, duid);
    }
    return messageDispatcher;
  }

  public getMapInfo(duid: string): Promise<MapInfo> {
    return this.getMessageDispatcher(duid).getMapInfo(duid);
  }

  public getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    return this.getMessageDispatcher(duid).getRoomMap(duid, activeMap);
  }

  /** Get current cleaning mode settings. */
  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    this.logger.notice('MessageRoutingService - getCleanModeData');
    const data = await this.getMessageDispatcher(duid).getCleanModeData(duid);
    if (!data) {
      throw new DeviceError('Failed to retrieve clean mode data', duid);
    }
    return data;
  }

  /** Get vacuum's current room from map. */
  public async getRoomIdFromMap(duid: string): Promise<number | undefined> {
    const data = await this.getMessageDispatcher(duid).getHomeMap(duid);
    return data?.vacuumRoom;
  }

  /** Change cleaning mode settings. */
  public async changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void> {
    this.logger.notice('MessageRoutingService - changeCleanMode');
    return this.getMessageDispatcher(duid).changeCleanMode(duid, setting);
  }

  /** Start cleaning (global, room-specific, or routine). */
  public async startClean(duid: string, selectedAreas: number[], supportedRooms: ServiceArea.Area[], supportedRoutines: ServiceArea.Area[]): Promise<void> {
    this.logger.debug('MessageRoutingService - begin cleaning', debugStringify({ duid, supportedRooms, supportedRoutines, selectedAreas }));

    // Handle routines first (higher priority)
    if (supportedRoutines.length > 0) {
      const handled = await this.tryStartRoutineClean(duid, selectedAreas, supportedRoutines);
      if (handled) return;
    }

    // Handle room-based clean
    return this.startRoomBasedClean(duid, selectedAreas, supportedRooms);
  }

  /** Try to start routine-based cleaning. Returns handled status and filtered room selection. */
  private async tryStartRoutineClean(duid: string, selected: number[], supportedRoutines: ServiceArea.Area[]): Promise<boolean> {
    const routines = selected.filter((slt) => supportedRoutines.some((a) => a.areaId === slt));

    if (routines.length === 0) {
      // No routines selected, continue with rooms
      return false;
    }

    const sortedRoutines = routines
      .map((areaId) => supportedRoutines.find((r) => r.areaId === areaId))
      .filter((area) => area !== undefined)
      .sort((areaA, areaB) => (areaA.areaInfo.locationInfo?.locationName ?? '').localeCompare(areaB.areaInfo.locationInfo?.locationName ?? ''));

    if (sortedRoutines.length === 0) {
      // No mapped routine found
      return false;
    }

    // Exactly one routine selected
    this.logger.debug('Starting routine', { duid, routine: sortedRoutines[0].areaInfo.locationInfo?.locationName });

    if (!this.iotApi) {
      throw new DeviceError('IoT API must be initialized to start scene', duid);
    }

    await this.iotApi.startScene(sortedRoutines[0].areaId);
    return true;
  }

  /** Start room-based or global cleaning. */
  private async startRoomBasedClean(duid: string, selected: number[], supportedRooms: ServiceArea.Area[]): Promise<void> {
    const shouldStartGlobalClean = selected.length === 0 || selected.length === supportedRooms.length || supportedRooms.length === 0;

    if (shouldStartGlobalClean) {
      this.logger.debug('Starting global clean');
      return this.startGlobalClean(duid);
    }

    this.logger.debug('Starting room clean', { duid, selected });
    return this.getMessageDispatcher(duid).startRoomCleaning(duid, selected, 1);
  }

  /** Start global cleaning (entire house). */
  private async startGlobalClean(duid: string): Promise<void> {
    return this.getMessageDispatcher(duid).startCleaning(duid);
  }

  public async pauseClean(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - pauseClean');
    await this.getMessageDispatcher(duid).pauseCleaning(duid);
  }

  public async stopAndGoHome(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - stopAndGoHome');
    await this.getMessageDispatcher(duid).goHome(duid);
  }

  public async resumeClean(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - resumeClean');
    await this.getMessageDispatcher(duid).resumeCleaning(duid);
  }

  public async stopClean(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - stopClean');
    await this.getMessageDispatcher(duid).stopCleaning(duid);
  }

  public async playSoundToLocate(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - findMe');
    await this.getMessageDispatcher(duid).findMyRobot(duid);
  }

  public async customGet<T = unknown>(duid: string, request: RequestMessage): Promise<T> {
    this.logger.debug('MessageRoutingService - customSend-message', request.method, request.params, request.secure);
    return this.getMessageDispatcher(duid).getCustomMessage(duid, request);
  }

  public async customSend(duid: string, request: RequestMessage): Promise<void> {
    return this.getMessageDispatcher(duid).sendCustomMessage(duid, request);
  }

  public clearAll(): void {
    this.messageDispatcherMap.clear();
    this.logger.debug('MessageRoutingService - All data cleared');
  }
}
