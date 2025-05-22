import { AnsiLogger } from 'node-ansi-logger';
import DeviceStatus from '../Zmodel/deviceStatus.js';
import { CloudMessageResult } from '../Zmodel/messageResult.js';
import NetworkInfo from '../Zmodel/networkInfo.js';
import Room from '../Zmodel/room.js';
import { RoomInfo } from '../Zmodel/roomInfo.js';
import Client from './client.js';
import { AbstractMessageHandler } from './listener/abstractMessageHandler.js';
import { SimpleMessageListener } from './listener/index.js';
import { RequestMessage } from './model/requestMessage.js';

export default class MessageApi {
  private readonly client: Client;
  private readonly messageListener: SimpleMessageListener;
  logger: AnsiLogger | undefined;

  constructor(client: Client) {
    this.client = client;

    this.messageListener = new SimpleMessageListener();
    this.client.registerMessageListener(this.messageListener);
  }

  public injectLogger(logger: AnsiLogger): void {
    this.logger = logger;
  }

  public registerListener(listener: AbstractMessageHandler): void {
    this.messageListener.registerListener(listener);
  }

  public async getNetworkInfo(duid: string): Promise<NetworkInfo> {
    const request = new RequestMessage({ method: 'get_network_info' });
    return await this.client.get(duid, request);
  }

  // public async getDeviceStatus(duid: string): Promise<DeviceStatus> {
  //   const request = new RequestMessage({ method: 'get_status' });
  //   return this.client.get<CloudMessageResult[]>(duid, request).then((response) => new DeviceStatus(response[0]));
  // }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus> {
    const request = new RequestMessage({ method: 'get_status' });
    const response = await this.client.get<CloudMessageResult>(duid, request);

    this.logger?.debug('Device status: ', JSON.stringify(response));
    return new DeviceStatus(response);
  }

  public async getRooms(duid: string, rooms: Room[]): Promise<RoomInfo> {
    const request = new RequestMessage({ method: 'get_room_mapping' });
    return this.client.get<number[][]>(duid, request).then((response) => new RoomInfo(rooms, response));
  }

  public async gotoDock(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_charge' });
    return this.client.send(duid, request);
  }

  public async startClean(duid: string) {
    const request = new RequestMessage({ method: 'app_start' });
    return this.client.send(duid, request);
  }

  public async startRoomClean(duid: string, roomIds: number[], repeat: number) {
    const request = new RequestMessage({
      method: 'app_segment_clean',
      params: [{ segments: roomIds, repeat: repeat }],
    });
    return this.client.send(duid, request);
  }

  public async pauseClean(duid: string) {
    const request = new RequestMessage({ method: 'app_pause' });
    return this.client.send(duid, request);
  }

  public async resumeClean(duid: string) {
    const request = new RequestMessage({ method: 'app_resume' });
    return this.client.send(duid, request);
  }

  public async stopClean(duid: string) {
    const request = new RequestMessage({ method: 'app_stop' });
    return this.client.send(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage) {
    const request = new RequestMessage(def);
    return this.client.send(duid, request);
  }

  public async findMyRobot(duid: string) {
    const request = new RequestMessage({ method: 'find_me' });
    return this.client.send(duid, request);
  }
}
