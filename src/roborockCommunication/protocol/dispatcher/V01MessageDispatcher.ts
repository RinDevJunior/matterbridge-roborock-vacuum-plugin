import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AbstractMessageDispatcher } from './abstractMessageDispatcher.js';
import { CloudMessageResult, DeviceStatus, NetworkInfo, RequestMessage, RoomDto } from '../../models/index.js';
import { Client } from '../../routing/client.js';
import { MapInfo, RoomMap } from '../../../core/application/models/index.js';
import { HomeModelMapper, MultipleMapDto, RawRoomMappingData } from '../../models/home/index.js';
import { MapRoomResponse } from '../../../types/index.js';
import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { MopRoute, VacuumSuctionPower } from '../../../behaviors/roborock.vacuum/enums/index.js';

export class V01MessageDispatcher implements AbstractMessageDispatcher {
  public dispatcherName = 'V01MessageDispatcher';
  constructor(
    private readonly logger: AnsiLogger,
    private readonly client: Client,
  ) {}

  public async getNetworkInfo(duid: string): Promise<NetworkInfo | undefined> {
    const request = new RequestMessage({ method: 'get_network_info' });
    return await this.client.get(duid, request);
  }

  public async getDeviceStatus(duid: string): Promise<DeviceStatus | undefined> {
    const request = new RequestMessage({ method: 'get_prop', params: ['get_status'] });
    const response = await this.client.get<CloudMessageResult[]>(duid, request);

    if (response) {
      this.logger.debug('Device status: ', debugStringify(response));
      return new DeviceStatus(response);
    }

    return undefined;
  }

  /* --------------- Core Data Retrieval --------------- */
  public async getHomeMap(duid: string): Promise<MapRoomResponse> {
    const request = new RequestMessage({ method: 'get_map_v1', secure: true });
    const response = await this.client.get<MapRoomResponse>(duid, request);
    return response ?? {};
  }

  public async getMapInfo(duid: string): Promise<MapInfo> {
    const request = new RequestMessage({ method: 'get_multi_maps_list' });
    const response = (await this.client.get<MultipleMapDto[]>(duid, request)) ?? [];
    return new MapInfo(response.length > 0 ? response[0] : { max_multi_map: 0, max_bak_map: 0, multi_map_count: 0, map_info: [] });
  }

  public async getRoomMap(duid: string, activeMap: number, rooms: RoomDto[]): Promise<RoomMap> {
    const request = new RequestMessage({ method: 'get_room_mapping' });
    const response = (await this.client.get<RawRoomMappingData>(duid, request)) ?? [];

    const mapRoomDtos = response.map((raw) => HomeModelMapper.rawArrayToMapRoomDto(raw, activeMap));
    const roomMappings = mapRoomDtos.map((dto) => HomeModelMapper.toRoomMapping(dto, rooms));
    const roomMap = new RoomMap(roomMappings);
    this.logger.debug(`Room mapping for device ${duid}: ${debugStringify(roomMap)}`);
    return roomMap;
  }

  /* ---------------- Cleaning Commands ---------------- */
  public async goHome(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_charge' });
    await this.client.send(duid, request);
  }

  public async startCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_start' });
    await this.client.send(duid, request);
  }

  public async startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void> {
    const request = new RequestMessage({
      method: 'app_segment_clean',
      params: [{ segments: roomIds, repeat: repeat }],
    });
    await this.client.send(duid, request);
  }

  public async pauseCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_pause' });
    await this.client.send(duid, request);
  }

  public async resumeCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_resume' });
    await this.client.send(duid, request);
  }

  public async resumeRoomCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'resume_segment_clean' });
    await this.client.send(duid, request);
  }

  public async stopCleaning(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'app_stop' });
    await this.client.send(duid, request);
  }

  public async findMyRobot(duid: string): Promise<void> {
    const request = new RequestMessage({ method: 'find_me' });
    await this.client.get(duid, request);
  }

  public async sendCustomMessage(duid: string, def: RequestMessage): Promise<void> {
    const request = new RequestMessage(def);
    return this.client.send(duid, request);
  }

  public getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T> {
    return this.client.get(duid, def) as Promise<T>;
  }

  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
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

    return new CleanModeSetting(suctionPower, waterFlow, distance_off, mopRoute);
  }

  public async changeCleanMode(duid: string, suctionPower: number, waterFlow: number, mopRoute: number, distance_off: number): Promise<void> {
    this.logger.notice(`Change clean mode for ${duid} to suctionPower: ${suctionPower}, waterFlow: ${waterFlow}, mopRoute: ${mopRoute}, distance_off: ${distance_off}`);

    const currentMopMode = await this.getCustomMessage<number>(duid, new RequestMessage({ method: 'get_custom_mode' }));
    const smartMopMode = VacuumSuctionPower.Smart;
    const smartMopRoute = MopRoute.Smart;
    const customMopMode = VacuumSuctionPower.Custom;
    const customMopRoute = MopRoute.Custom;

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
