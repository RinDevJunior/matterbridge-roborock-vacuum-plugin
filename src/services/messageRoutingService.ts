import { AnsiLogger } from 'matterbridge/logger';
import { DeviceError } from '../errors/index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { RawRoomMappingData, RequestMessage } from '../roborockCommunication/models/index.js';
import { AbstractMessageDispatcher } from '../roborockCommunication/protocol/dispatcher/abstractMessageDispatcher.js';
import { MapInfo } from '../core/application/models/index.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanCommand } from '../model/CleanCommand.js';

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

  public async startClean(duid: string, command: CleanCommand): Promise<void> {
    switch (command.type) {
      case 'routine': {
        if (!this.iotApi) {
          throw new DeviceError('IoT API must be initialized to start scene', duid);
        }
        this.logger.notice(`[MessageRoutingService] Start routine ${command.routineId}`);
        await this.iotApi.startScene(command.routineId);
        return;
      }
      case 'room': {
        this.logger.notice(`[MessageRoutingService] Start room cleaning ${command.roomIds}`);
        return this.getMessageDispatcher(duid).startRoomCleaning(duid, command.roomIds, 1);
      }

      case 'global': {
        this.logger.notice(`[MessageRoutingService] Start global cleaning`);
        return this.getMessageDispatcher(duid).startCleaning(duid);
      }
    }
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
