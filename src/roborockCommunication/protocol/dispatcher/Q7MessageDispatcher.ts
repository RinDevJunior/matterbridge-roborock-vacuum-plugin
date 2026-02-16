import { randomInt } from 'node:crypto';
import { Q7CleanType, Q7ControlCode, Q7RequestCode, Q7RequestMethod } from '../../enums/Q7RequestCode.js';
import { DeviceStatus } from '../../models/deviceStatus.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Client } from '../../routing/client.js';
import { NetworkInfo, RawRoomMappingData } from '../../models/index.js';
import { resolveQ7CleanMode, resolveMopMode, resolveVacuumMode, resolveCleanRoute } from '../../helper/B01VacuumModeResolver.js';
import { MapInfo } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/device.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

export class Q7MessageDispatcher implements AbstractMessageDispatcher {
  public dispatcherName = 'Q7MessageDispatcher';
  private lastB01Id: number;
  // private readonly b01MapParser = new B01MapParser();

  private get messageId() {
    let tmpMessageId = Date.now();
    if (tmpMessageId <= this.lastB01Id) {
      tmpMessageId = this.lastB01Id + 1;
    }
    this.lastB01Id = tmpMessageId;

    return this.lastB01Id;
  }

  constructor(
    private readonly logger: AnsiLogger,
    private readonly client: Client,
  ) {
    this.lastB01Id = Date.now();
  }

  public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
    // Q7 does not support getting network info, or maybe I just haven't found the right command yet.
    return undefined;
  }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
    // TODO: Implement getting device status for Q7
    return undefined;
  }

  // #region Core Data Retrieval
  public async getHomeMap(duid: string): Promise<MapRoomResponse> {
    return {};
  }

  public async getMapInfo(duid: string): Promise<MapInfo> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_map_list, {}) });
    const response = await this.client.get<object>(duid, request);

    this.logger.notice(`Get map info response for Q7 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
    return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
  }

  public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_room_mapping_backup_1, { map_id: activeMap, prefer_type: 1 }) });
    const response = (await this.client.get<RawRoomMappingData>(duid, request)) ?? [];

    this.logger.notice(`Get room map response for Q7 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
    return response; // TODO: Implement proper room mapping retrieval for Q7
  }

  // public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
  //   const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.get_room_mapping, { force: 1, map_type: 0 }) });
  //   const response = await this.client.get<ResponseBody>(duid, request);
  //   if (!response) {
  //     this.logger.error(`Get room map for Q7 device: ${duid}: no response`);
  //     return [];
  //   }

  //   const responseData = response.get(Protocol.map_response) as Buffer;
  //   const parsed = this.b01MapParser.parseRooms(responseData);
  //   return parsed.rooms.map((x) => [x.roomId, x.roomName, x.roomTypeId ?? 0]);
  // }
  // #endregion Core Data Retrieval

  // #region Cleaning Commands
  public async goHome(duid: string): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.app_charge, {}) });
    await this.client.send(duid, request);
  }

  public async startCleaning(duid: string): Promise<void> {
    await this.startRoomCleaning(duid, [], 1);
  }

  public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({
      messageId: this.messageId,
      dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: Q7CleanType.room_clean, ctrl_value: Q7ControlCode.start, room_ids: roomIds }),
    });
    await this.client.send(duid, request);
  }

  public async pauseCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({
      messageId: this.messageId,
      dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: Q7CleanType.full_clean, ctrl_value: Q7ControlCode.pause, room_ids: [] }),
    });
    await this.client.send(duid, request);
  }

  public async resumeCleaning(duid: string): Promise<void> {
    await this.startCleaning(duid);
  }

  public async resumeRoomCleaning(duid: string): Promise<void> {
    await this.startRoomCleaning(duid, [], 1);
  }

  public async stopCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({
      messageId: this.messageId,
      dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: Q7CleanType.full_clean, ctrl_value: Q7ControlCode.stop, room_ids: [] }),
    });
    await this.client.send(duid, request);
  }

  public async findMyRobot(duid: string): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.find_me, {}) });
    await this.client.send(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
    const request = new RequestMessage({ ...def, messageId: this.messageId });
    await this.client.send(duid, request);
  }

  public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
    const request = new RequestMessage({ ...def, messageId: this.messageId });
    return this.client.get(duid, request) as Promise<T>;
  }

  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    return new CleanModeSetting(0, 0, 0, 0, CleanSequenceType.Persist); // TODO: Implement retrieval of clean mode data for Q7
  }

  public async changeCleanMode(duid: string, setting: CleanModeSetting): Promise<void> {
    const { suctionPower, waterFlow, distance_off, mopRoute } = setting;
    this.logger?.notice(`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`);
    await this.setCleanMode(duid, suctionPower, waterFlow);
    if (suctionPower !== 0) {
      await this.setVacuumMode(duid, suctionPower);
    }
    if (waterFlow !== 0) {
      await this.setMopMode(duid, waterFlow);
    }
  }
  // #endregion Cleaning Commands

  // #region Private Helpers
  private createDps(method: string, params: unknown): Record<number, unknown> {
    const messageId = randomInt(100000000000, 999999999999).toString();
    return { [Q7RequestCode.query]: { msgId: messageId, method: method, params: params } };
  }

  private async setCleanMode(duid: string, suctionPower: number, waterFlow: number): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.set_prop, { 'mode': resolveQ7CleanMode(suctionPower, waterFlow) }) });
    await this.client.send(duid, request);
  }

  private async setVacuumMode(duid: string, suctionPower: number): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.set_prop, { 'wind': resolveVacuumMode(suctionPower) }) });
    await this.client.send(duid, request);
  }

  private async setMopMode(duid: string, waterFlow: number): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.set_prop, { 'water': resolveMopMode(waterFlow) }) });
    await this.client.send(duid, request);
  }

  async setCleanRoute(duid: string, mopRoute: number): Promise<void> {
    const request = new RequestMessage({ messageId: this.messageId, dps: this.createDps(Q7RequestMethod.set_prop, { 'clean_path_preference': resolveCleanRoute(mopRoute) }) });
    await this.client.send(duid, request);
  }
  // #endregion Private Helpers
}
