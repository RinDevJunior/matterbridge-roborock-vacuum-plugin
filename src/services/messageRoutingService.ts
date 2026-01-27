import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import type { CleanModeSetting } from '../behaviors/roborock.vacuum/default/default.js';
import { DeviceError } from '../errors/index.js';
import { MessageProcessor } from '../roborockCommunication/mqtt/messageProcessor.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { RequestMessage, RoomDto } from '../roborockCommunication/models/index.js';
import { AbstractMessageDispatcher } from '../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MapInfo, RoomMap } from '../core/application/models/index.js';

export class MessageRoutingService {
  private messageProcessorMap = new Map<string, MessageProcessor>();
  private messageDispatcherMap = new Map<string, AbstractMessageDispatcher>();

  constructor(
    private readonly logger: AnsiLogger,
    private iotApi?: RoborockIoTApi,
  ) {}

  /** Set IoT API instance. */
  public setIotApi(iotApi: RoborockIoTApi): void {
    this.iotApi = iotApi;
  }

  /** Register message processor for a device. */
  public registerMessageProcessor(duid: string, messageProcessor: MessageProcessor): void {
    this.messageProcessorMap.set(duid, messageProcessor);
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

  /** Get message processor for a device. Throws if not initialized. */
  public getMessageProcessor(duid: string): MessageProcessor {
    const messageProcessor = this.messageProcessorMap.get(duid);
    if (!messageProcessor) {
      throw new DeviceError(`MessageProcessor not initialized for device ${duid}`, duid);
    }
    return messageProcessor;
  }

  public getMapInfo(duid: string): Promise<MapInfo> {
    return this.getMessageDispatcher(duid).getMapInfo(duid);
  }

  public getRoomMap(duid: string, activeMap: number, rooms: RoomDto[]): Promise<RoomMap> {
    return this.getMessageDispatcher(duid).getRoomMap(duid, activeMap, rooms);
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
  public async changeCleanMode(duid: string, { suctionPower, waterFlow, distance_off, mopRoute }: CleanModeSetting): Promise<void> {
    this.logger.notice('MessageRoutingService - changeCleanMode');
    return this.getMessageDispatcher(duid).changeCleanMode(duid, suctionPower, waterFlow, mopRoute ?? 0, distance_off);
  }

  /** Start cleaning (global, room-specific, or routine). */
  public async startClean(duid: string, selectedAreas: number[], supportedRooms: ServiceArea.Area[], supportedRoutines: ServiceArea.Area[]): Promise<void> {
    let selected = selectedAreas;

    this.logger.debug('MessageRoutingService - begin cleaning', debugStringify({ duid, supportedRooms, supportedRoutines, selected }));

    // Handle routines first (higher priority)
    if (supportedRoutines.length > 0) {
      const result = await this.tryStartRoutineClean(duid, selected, supportedRooms, supportedRoutines);
      if (result.handled) {
        return;
      }
      // Fall through to room-based clean with filtered selection
      selected = result.filteredSelection;
    }

    // Handle room-based clean
    return this.startRoomBasedClean(duid, selected, supportedRooms);
  }

  /** Try to start routine-based cleaning. Returns handled status and filtered room selection. */
  private async tryStartRoutineClean(
    duid: string,
    selected: number[],
    supportedRooms: ServiceArea.Area[],
    supportedRoutines: ServiceArea.Area[],
  ): Promise<{ handled: boolean; filteredSelection: number[] }> {
    const routines = selected.filter((slt) => supportedRoutines.some((a) => a.areaId === slt));
    const rooms = selected.filter((slt) => supportedRooms.some((a) => a.areaId === slt));

    if (routines.length === 0) {
      // No routines selected, continue with rooms
      return { handled: false, filteredSelection: rooms };
    }

    if (routines.length > 1) {
      this.logger.warn('Multiple routines selected - falling back to global clean', { duid, routines });
      await this.startGlobalClean(duid);
      return { handled: true, filteredSelection: [] };
    }

    // Exactly one routine selected
    this.logger.debug('Starting routine', { duid, routine: routines[0] });

    if (!this.iotApi) {
      throw new DeviceError('IoT API must be initialized to start scene', duid);
    }

    await this.iotApi.startScene(routines[0]);
    return { handled: true, filteredSelection: [] };
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
    this.messageProcessorMap.clear();
    this.messageDispatcherMap.clear();
    this.logger.debug('MessageRoutingService - All data cleared');
  }
}
