import { AnsiLogger } from 'matterbridge/logger';
import { DeviceStatus } from '../../models/deviceStatus.js';
import { CloudMessageResult } from '../../models/messageResult.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { Q10RequestCode, Q10RequestMethod } from '../../enums/Q10RequestCode.js';
import { Client } from '../../routing/client.js';
import { NetworkInfo, RawRoomMappingData } from '../../models/index.js';
import { resolveMopMode, resolveQ10CleanMode, resolveVacuumMode } from '../../helper/B01VacuumModeResolver.js';
import { MapInfo } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/index.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';

export class Q10MessageDispatcher implements AbstractMessageDispatcher {
  public dispatcherName = 'Q10MessageDispatcher';
  constructor(
    private readonly logger: AnsiLogger,
    private readonly client: Client,
  ) {}

  public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
    // Q10 does not support getting network info, or maybe I just haven't found the right command yet.
    return undefined;
  }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.rpc_response]: 1 } });
    await this.client.get<CloudMessageResult[]>(duid, request);

    // Q10 will return device status via MQTT (or not :) ) messages, so we return undefined here.
    return undefined;
  }

  // #region Core Data Retrieval
  public async getHomeMap(duid: string): Promise<MapRoomResponse> {
    return {}; // TODO: Implement home map retrieval for Q10
  }

  public async getMapInfo(duid: string): Promise<MapInfo> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.rpc_request]: { [Q10RequestMethod.multimap]: { 'op': 'list' } } } });
    const response = await this.client.get<object>(duid, request);
    this.logger.notice(`Get map info response for Q10 device ${duid}: ${response ? JSON.stringify(response) : 'no response'}`);
    return new MapInfo({ max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
  }

  public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.get_prop]: 1 } });
    const response = await this.client.get<{ room_mapping: RawRoomMappingData }>(duid, request);
    return response?.room_mapping ?? []; // TODO: Implement proper room mapping retrieval for Q10
  }
  // #endregion Core Data Retrieval

  // #region Cleaning Commands
  public async goHome(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_charge]: 0 } });
    await this.client.send(duid, request);
  }

  public async startCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_start]: { 'cmd': 1 } } });
    await this.client.send(duid, request);
  }

  public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_start]: { 'cmd': 2, 'clean_paramters': roomIds } } });
    await this.client.send(duid, request);
  }

  public async pauseCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_pause]: 0 } });
    await this.client.send(duid, request);
  }

  public async resumeCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_resume]: 0 } });
    await this.client.send(duid, request);
  }

  public async resumeRoomCleaning(duid: string): Promise<void> {
    await this.resumeCleaning(duid);
  }

  public async stopCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestCode.app_stop]: 0 } });
    await this.client.send(duid, request);
  }

  public async findMyRobot(duid: string): Promise<void> {
    // TODO: Verify the command for Q10
    const request = new RequestMessage({ method: 'find_me' });
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
    return new CleanModeSetting(0, 0, 0, 0); // TODO: Implement retrieval of clean mode data for Q10
  }

  public async changeCleanMode(duid: string, suctionPower: number, waterFlow: number, mopRoute: number, distance_off: number): Promise<void> {
    this.logger?.notice(`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`);
    await this.setCleanMode(duid, suctionPower, waterFlow);
    if (suctionPower !== 0) {
      await this.setVacuumMode(duid, suctionPower);
    }
    if (waterFlow !== 0) {
      await this.setWaterMode(duid, waterFlow);
    }
  }
  // #endregion Cleaning Commands

  // #region Private Helpers
  private async setCleanMode(duid: string, suctionPower: number, waterFlow: number): Promise<void> {
    const request = new RequestMessage({ dps: { [Q10RequestMethod.change_clean_mode]: resolveQ10CleanMode(suctionPower, waterFlow) } });
    return this.client.send(duid, request);
  }

  private async setVacuumMode(duid: string, mode: number) {
    const request = new RequestMessage({ dps: { [Q10RequestMethod.change_vacuum_mode]: resolveVacuumMode(mode) } });
    return this.client.send(duid, request);
  }

  private async setWaterMode(duid: string, mode: number) {
    const request = new RequestMessage({ dps: { [Q10RequestMethod.change_mop_mode]: resolveMopMode(mode) } });
    return this.client.send(duid, request);
  }
  // #endregion Private Helpers
}
