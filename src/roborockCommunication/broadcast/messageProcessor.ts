import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { RequestMessage, CloudMessageResult, DeviceStatus, NetworkInfo, AbstractMessageHandler, SimpleMessageListener } from '../index.js';
import { Client } from './client.js';
import { CleanModeDTO } from '@/behaviors/index.js';

export class MessageProcessor {
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

  public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
    const request = new RequestMessage({ method: 'get_network_info' });
    return await this.client.get(duid, request);
  }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
    const request = new RequestMessage({ method: 'get_prop', params: ['get_status'] });
    const response = await this.client.get<CloudMessageResult[]>(duid, request);

    if (response) {
      this.logger?.debug('Device status: ', debugStringify(response));
      return new DeviceStatus(response);
    }

    return undefined;
  }

  public async getDeviceStatusOverMQTT(duid: string): Promise<DeviceStatus | undefined> {
    const request = new RequestMessage({ method: 'get_prop', params: ['get_status'], secure: true });
    const response = await this.client.get<CloudMessageResult[]>(duid, request);

    if (response) {
      this.logger?.debug('MQTT - Device status: ', debugStringify(response));
      return new DeviceStatus(response);
    }

    return undefined;
  }

  public async getRooms(duid: string): Promise<number[][] | undefined> {
    const request = new RequestMessage({ method: 'get_room_mapping' });
    return this.client.get<number[][] | undefined>(duid, request); // .then((response) => new RoomInfo(rooms, response ?? []));
  }

  public async gotoDock(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_charge' });
    return this.client.send(duid, request);
  }

  public async startClean(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_start' });
    return this.client.send(duid, request);
  }

  public async startRoomClean(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({
      method: 'app_segment_clean',
      params: [{ segments: roomIds, repeat: repeat }],
    });
    return this.client.send(duid, request);
  }

  public async pauseClean(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_pause' });
    return this.client.send(duid, request);
  }

  public async resumeClean(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_resume' });
    return this.client.send(duid, request);
  }

  public async stopClean(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_stop' });
    return this.client.send(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
    const request = new RequestMessage(def);
    return this.client.send(duid, request);
  }

  /**
   * Execute a custom GET request to the device.
   * @param duid - Device unique identifier
   * @param def - The request message definition
   * @returns Response data typed as T (defaults to unknown for flexibility)
   *
   * @example
   * // With explicit type
   * const mapData = await getCustomMessage<MapRoomResponse>(duid, request);
   *
   * // Type inferred as unknown
   * const result = await getCustomMessage(duid, request);
   */
  public getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
    return this.client.get(duid, def) as Promise<T>;
  }

  public async findMyRobot(duid: string): Promise<unknown> {
    const request = new RequestMessage({ method: 'find_me' });
    return this.client.get(duid, request);
  }

  public async getCleanModeData(duid: string): Promise<CleanModeDTO> {
    const currentMopMode = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_mop_mode' }));
    const suctionPowerRaw = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_custom_mode' }));
    const waterFlowRaw = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_water_box_custom_mode' }));

    let suctionPower: number;
    let waterFlow: number;
    let mopRoute: number;
    let distance_off = 0;

    if (Array.isArray(suctionPowerRaw)) {
      suctionPower = suctionPowerRaw[0];
    } else {
      suctionPower = suctionPowerRaw as number;
    }

    if (Array.isArray(currentMopMode)) {
      mopRoute = currentMopMode[0];
    } else {
      mopRoute = currentMopMode as number;
    }

    if (typeof waterFlowRaw === 'object' && waterFlowRaw !== null && 'water_box_mode' in waterFlowRaw) {
      waterFlow = waterFlowRaw.water_box_mode as number;

      if ('distance_off' in waterFlowRaw) {
        distance_off = (waterFlowRaw.distance_off as number) ?? 0;
      }
    } else {
      waterFlow = waterFlowRaw as number;
    }

    return {
      suctionPower: suctionPower,
      waterFlow: waterFlow,
      distance_off: distance_off,
      mopRoute: mopRoute,
    } satisfies CleanModeDTO;
  }

  public async changeCleanMode(duid: string, suctionPower: number, waterFlow: number, mopRoute: number, distance_off: number): Promise<void> {
    this.logger?.notice(`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`);

    const currentMopMode = await this.getCustomMessage(duid, new RequestMessage({ method: 'get_custom_mode' }));
    const smartMopMode = 110;
    const smartMopRoute = 306;
    const customMopMode = 106;
    const customMopRoute = 302;

    if (currentMopMode == smartMopMode && mopRoute == smartMopRoute) return;
    if (currentMopMode == customMopMode && mopRoute == customMopRoute) return;

    // if change mode from smart plan, firstly change to custom
    if (currentMopMode == smartMopMode) {
      await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [customMopRoute] }));
    }

    if (suctionPower && suctionPower != 0) {
      await this.client.send(duid, new RequestMessage({ method: 'set_custom_mode', params: [suctionPower] }));
    }

    const CustomizeWithDistanceOff = 207;
    if (waterFlow && waterFlow == CustomizeWithDistanceOff && distance_off && distance_off != 0) {
      await this.client.send(duid, new RequestMessage({ method: 'set_water_box_custom_mode', params: { 'water_box_mode': waterFlow, 'distance_off': distance_off } }));
    } else if (waterFlow && waterFlow != 0) {
      await this.client.send(duid, new RequestMessage({ method: 'set_water_box_custom_mode', params: [waterFlow] }));
    }

    if (mopRoute && mopRoute != 0) {
      await this.client.send(duid, new RequestMessage({ method: 'set_mop_mode', params: [mopRoute] }));
    }
  }
}
