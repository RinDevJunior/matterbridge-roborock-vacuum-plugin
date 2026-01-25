import { randomInt } from 'node:crypto';
import { Q7RequestCode, Q7RequestMethod } from '../../enums/Q7RequestCode.js';
import { DeviceStatus } from '../../models/deviceStatus.js';
import { RequestMessage } from '../../models/requestMessage.js';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Client } from '../../routing/client.js';
import { NetworkInfo } from '../../models/index.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/default/default.js';
import { resolveQ7CleanMode, resolveMopMode, resolveVacuumMode, resolveCleanRoute } from '../../helper/B01VacuumModeResolver.js';

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

  public async goHome(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.app_charge, {}) });
    await this.client.send(duid, request);
  }

  public async startCleaning(duid: string): Promise<void> {
    await this.startRoomCleaning(duid, [], 1);
  }

  public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: 0, ctrl_value: 1, room_ids: roomIds }) });
    await this.client.send(duid, request);
  }

  public async pauseCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: 0, ctrl_value: 2, room_ids: [] }) });
    await this.client.send(duid, request);
  }

  public async resumeCleaning(duid: string): Promise<void> {
    await this.startCleaning(duid);
  }

  public async resumeRoomCleaning(duid: string): Promise<void> {
    await this.startRoomCleaning(duid, [], 1);
  }

  public async stopCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.app_start_stop, { clean_type: 0, ctrl_value: 0, room_ids: [] }) });
    await this.client.send(duid, request);
  }

  public async findMyRobot(duid: string): Promise<void> {
    // TODO: Implement find my robot for Q7
  }

  public async getRooms(duid: string, activeMap: number): Promise<number[][] | undefined> {
    const request = new RequestMessage({ dps: this.createDps(Q7RequestMethod.get_room_mapping, { map_id: activeMap, prefer_type: 1 }) });
    return this.client.get<number[][] | undefined>(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
    const request = new RequestMessage(def);
    return this.client.send(duid, request);
  }

  public async getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
    return this.client.get(duid, def) as Promise<T>;
  }

  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    return { suctionPower: 2, waterFlow: 2, mopRoute: 0, distance_off: 0 };
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
