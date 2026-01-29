import { randomInt } from 'node:crypto';
import { Q7CleanType, Q7ControlCode, Q7RequestCode, Q7RequestMethod } from '../../enums/Q7RequestCode.js';
import { DeviceStatus } from '../../models/deviceStatus.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Client } from '../../routing/client.js';
import { NetworkInfo, RoomDto } from '../../models/index.js';
import { resolveQ7CleanMode, resolveMopMode, resolveVacuumMode, resolveCleanRoute } from '../../helper/B01VacuumModeResolver.js';
import { MapInfo, RoomMap } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/device.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';

export class Q7MessageDispatcher implements AbstractMessageDispatcher {
  constructor(
    private readonly logger: AnsiLogger,
    private readonly client: Client,
  ) {}

  public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
    // Q7 does not support getting network info, or maybe I just haven't found the right command yet.
    return undefined;
  }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
    // TODO: Implement getting device status for Q7
    return undefined;
  }

  /* --------------- Core Data Retrieval --------------- */
  public async getHomeMap(duid: string): Promise<MapRoomResponse> {
    return {};
  }

  public async getMapInfo(duid: string): Promise<MapInfo> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.get_map_list, {}) });
    const response = await this.client.get<object>(duid, request);

    this.logger.notice(`Get map info response for Q7 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
    return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
  }

  public async getRoomMap(duid: string, activeMap: number, rooms: RoomDto[]): Promise<RoomMap> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.get_room_mapping, { map_id: activeMap, prefer_type: 1 }) });
    const response = await this.client.get<number[][] | undefined>(duid, request);

    this.logger.notice(`Get room map response for Q7 device ${duid}: ${response ? debugStringify(response) : 'no response'}`);
    return new RoomMap([]); // TODO: Implement proper room mapping retrieval for Q7
  }

  /* ---------------- Cleaning Commands ---------------- */
  public async goHome(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.app_charge, {}) });
    await this.client.send(duid, request);
  }

  public async startCleaning(duid: string): Promise<void> {
    await this.startRoomCleaning(duid, [], 1);
  }

  public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({
      dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: Q7CleanType.room_clean, ctrl_value: Q7ControlCode.start, room_ids: roomIds }),
    });
    await this.client.send(duid, request);
  }

  public async pauseCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({
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
      dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: Q7CleanType.full_clean, ctrl_value: Q7ControlCode.stop, room_ids: [] }),
    });
    await this.client.send(duid, request);
  }

  public async findMyRobot(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.find_me, {}) });
    await this.client.send(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
    const request = new RequestMessage(def);
    return this.client.send(duid, request);
  }

  public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
    return this.client.get(duid, def) as Promise<T>;
  }

  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    return new CleanModeSetting(0, 0, 0, 0); // TODO: Implement retrieval of clean mode data for Q7
  }

  public async changeCleanMode(duid: string, suctionPower: number, waterFlow: number, mopRoute: number, distance_off: number): Promise<void> {
    this.logger?.notice(`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`);
    await this.setCleanMode(duid, suctionPower, waterFlow);
    if (suctionPower !== 0) {
      await this.setVacuumMode(duid, suctionPower);
    }
    if (waterFlow !== 0) {
      await this.setMopMode(duid, waterFlow);
    }
  }

  private createDps(method: string, params: unknown): Record<number, unknown> {
    const messageId = randomInt(100000000000, 999999999999).toString();
    return { [Q7RequestCode.query]: { msgId: messageId, method: method, params: params } };
  }

  private async setCleanMode(duid: string, suctionPower: number, waterFlow: number): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.set_prop, { 'mode': resolveQ7CleanMode(suctionPower, waterFlow) }) });
    await this.client.send(duid, request);
  }

  private setVacuumMode(duid: string, suctionPower: number): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.set_prop, { 'wind': resolveVacuumMode(suctionPower) }) });
    return this.client.send(duid, request);
  }

  private setMopMode(duid: string, waterFlow: number): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.set_prop, { 'water': resolveMopMode(waterFlow) }) });
    return this.client.send(duid, request);
  }

  async setCleanRoute(duid: string, mopRoute: number): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.set_prop, { 'clean_path_preference': resolveCleanRoute(mopRoute) }) });
    await this.client.send(duid, request);
  }
}
