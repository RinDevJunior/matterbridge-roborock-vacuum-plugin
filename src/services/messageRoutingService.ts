import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import type { CleanModeSetting } from '../behaviors/roborock.vacuum/default/default.js';
import { DeviceError } from '../errors/index.js';
import { MessageProcessor } from '../roborockCommunication/mqtt/messageProcessor.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { RequestMessage } from '../roborockCommunication/models/index.js';

/** Response from map room queries. */
interface MapRoomResponse {
  vacuumRoom?: number;
}

/** Routes and executes device commands (cleaning, mode changes, custom messages). */
export class MessageRoutingService {
  // Message processor map: duid -> MessageProcessor
  private messageProcessorMap = new Map<string, MessageProcessor>();

  // MQTT always-on devices (use MQTT protocol exclusively)
  private mqttAlwaysOnDevices = new Map<string, boolean>();

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

  /** Get message processor for a device. Throws if not initialized. */
  public getMessageProcessor(duid: string): MessageProcessor {
    const messageProcessor = this.messageProcessorMap.get(duid);
    if (!messageProcessor) {
      throw new DeviceError(`MessageProcessor not initialized for device ${duid}`, duid);
    }
    return messageProcessor;
  }

  /** Mark device as MQTT-only (no local network). */
  public setMqttAlwaysOn(duid: string, mqttOnly: boolean): void {
    this.mqttAlwaysOnDevices.set(duid, mqttOnly);
  }

  public getMqttAlwaysOn(duid: string): boolean {
    return this.mqttAlwaysOnDevices.get(duid) ?? false;
  }

  /** Check if device requires secure protocol (MQTT-only). */
  private isRequestSecure(duid: string): boolean {
    return this.mqttAlwaysOnDevices.get(duid) ?? false;
  }

  /** Get current cleaning mode settings. */
  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    this.logger.notice('MessageRoutingService - getCleanModeData');
    const data = await this.getMessageProcessor(duid).getCleanModeData(duid);
    if (!data) {
      throw new DeviceError('Failed to retrieve clean mode data', duid);
    }
    return data;
  }

  /** Get vacuum's current room from map. */
  public async getRoomIdFromMap(duid: string): Promise<number | undefined> {
    const data = await this.customGet<MapRoomResponse>(duid, new RequestMessage({ method: 'get_map_v1', secure: true }));
    return data?.vacuumRoom;
  }

  /** Change cleaning mode settings. */
  public async changeCleanMode(duid: string, { suctionPower, waterFlow, distance_off, mopRoute }: CleanModeSetting): Promise<void> {
    this.logger.notice('MessageRoutingService - changeCleanMode');
    return this.getMessageProcessor(duid).changeCleanMode(duid, suctionPower, waterFlow, mopRoute ?? 0, distance_off);
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
    return this.getMessageProcessor(duid).startRoomClean(duid, selected, 1);
  }

  /** Start global cleaning (entire house). */
  private async startGlobalClean(duid: string): Promise<void> {
    return this.getMessageProcessor(duid).startClean(duid);
  }

  /**
   * Pause the current cleaning operation.
   */
  public async pauseClean(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - pauseClean');
    await this.getMessageProcessor(duid).pauseClean(duid);
  }

  /**
   * Stop cleaning and return to the charging dock.
   */
  public async stopAndGoHome(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - stopAndGoHome');
    await this.getMessageProcessor(duid).gotoDock(duid);
  }

  /**
   * Resume a paused cleaning operation.
   */
  public async resumeClean(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - resumeClean');
    await this.getMessageProcessor(duid).resumeClean(duid);
  }

  /**
   * Play a sound to help locate the vacuum.
   */
  public async playSoundToLocate(duid: string): Promise<void> {
    this.logger.debug('MessageRoutingService - findMe');
    await this.getMessageProcessor(duid).findMyRobot(duid);
  }

  /**
   * Execute a custom GET request to the device.
   */
  public async customGet<T = unknown>(duid: string, request: RequestMessage): Promise<T> {
    this.logger.debug('MessageRoutingService - customSend-message', request.method, request.params, request.secure);
    return this.getMessageProcessor(duid).getCustomMessage(duid, request);
  }

  /**
   * Send a custom command to the device without expecting a response.
   */
  public async customSend(duid: string, request: RequestMessage): Promise<void> {
    return this.getMessageProcessor(duid).sendCustomMessage(duid, request);
  }

  /**
   * Clear all message routing data.
   * Used during service shutdown or reset.
   */
  public clearAll(): void {
    this.messageProcessorMap.clear();
    this.mqttAlwaysOnDevices.clear();
    this.logger.debug('MessageRoutingService - All data cleared');
  }
}
