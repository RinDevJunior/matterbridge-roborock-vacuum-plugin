import assert from 'node:assert';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import ClientManager from './clientManager.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { clearInterval } from 'node:timers';
import {
  RoborockAuthenticateApi,
  UserData,
  RoborockIoTApi,
  ClientRouter,
  MessageProcessor,
  Client,
  Device,
  DeviceStatus,
  Home,
  Protocol,
  RequestMessage,
  VacuumErrorCode,
  ResponseMessage,
  Scene,
  SceneParam,
  MapInfo,
} from './roborockCommunication/index.js';
import type { AbstractMessageHandler, AbstractMessageListener, BatteryMessage, DeviceErrorMessage, DeviceStatusNotify, MultipleMap } from './roborockCommunication/index.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { LocalNetworkClient } from './roborockCommunication/broadcast/client/LocalNetworkClient.js';
import { RoomIndexMap } from './model/roomIndexMap.js';
export type Factory<A, T> = (logger: AnsiLogger, arg: A) => T;

export default class RoborockService {
  private loginApi: RoborockAuthenticateApi;
  private logger: AnsiLogger;
  private readonly iotApiFactory: Factory<UserData, RoborockIoTApi>;

  private iotApi?: RoborockIoTApi;
  private userdata?: UserData;
  deviceNotify?: (messageSource: NotifyMessageTypes, homeData: unknown) => void;
  messageClient: ClientRouter | undefined;
  remoteDevices = new Set<string>();
  messageProcessorMap = new Map<string, MessageProcessor>();
  ipMap = new Map<string, string>();
  localClientMap = new Map<string, Client>();
  mqttAlwaysOnDevices = new Map<string, boolean>();
  clientManager: ClientManager;
  refreshInterval: number;
  requestDeviceStatusInterval: NodeJS.Timeout | undefined;

  // These are properties that are used to store the state of the device
  private supportedAreas = new Map<string, ServiceArea.Area[]>();
  private supportedRoutines = new Map<string, ServiceArea.Area[]>();
  private selectedAreas = new Map<string, number[]>();
  private supportedAreaIndexMaps = new Map<string, RoomIndexMap>();

  private readonly vacuumNeedAPIV3 = ['roborock.vacuum.ss07'];

  constructor(
    authenticateApiSupplier: Factory<void, RoborockAuthenticateApi> = (logger) => new RoborockAuthenticateApi(logger),
    iotApiSupplier: Factory<UserData, RoborockIoTApi> = (logger, ud) => new RoborockIoTApi(ud, logger),
    refreshInterval: number,
    clientManager: ClientManager,
    logger: AnsiLogger,
  ) {
    this.logger = logger;
    this.loginApi = authenticateApiSupplier(logger);
    this.iotApiFactory = iotApiSupplier;
    this.refreshInterval = refreshInterval;
    this.clientManager = clientManager;
  }

  public async loginWithPassword(
    username: string,
    password: string,
    loadSavedUserData: () => Promise<UserData | undefined>,
    savedUserData: (userData: UserData) => Promise<void>,
  ): Promise<UserData> {
    let userdata = await loadSavedUserData();

    if (!userdata) {
      this.logger.debug('No saved user data found, logging in with password');
      userdata = await this.loginApi.loginWithPassword(username, password);
      await savedUserData(userdata);
    } else {
      this.logger.debug('Using saved user data for login', debugStringify(userdata));
      userdata = await this.loginApi.loginWithUserData(username, userdata);
    }

    return this.auth(userdata);
  }

  public getMessageProcessor(duid: string): MessageProcessor | undefined {
    const messageProcessor = this.messageProcessorMap.get(duid);
    if (!messageProcessor) {
      this.logger.error('MessageApi is not initialized.');
    }
    return messageProcessor;
  }

  public setSelectedAreas(duid: string, selectedAreas: number[]): void {
    this.logger.debug('RoborockService - setSelectedAreas', selectedAreas);

    const areas = selectedAreas.map((areaId) => this.supportedAreaIndexMaps.get(duid)?.getRoomIndex(areaId)) ?? [];

    this.selectedAreas.set(
      duid,
      areas.filter((area) => area !== undefined).map((area) => area!),
    );
  }

  public getSelectedAreas(duid: string): number[] {
    return this.selectedAreas.get(duid) ?? [];
  }

  public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
    this.supportedAreas.set(duid, supportedAreas);
  }

  public setSupportedAreaIndexMap(duid: string, indexMap: RoomIndexMap): void {
    this.supportedAreaIndexMaps.set(duid, indexMap);
  }

  public setSupportedScenes(duid: string, routineAsRooms: ServiceArea.Area[]) {
    this.supportedRoutines.set(duid, routineAsRooms);
  }

  public getSupportedAreas(duid: string): ServiceArea.Area[] | undefined {
    return this.supportedAreas.get(duid);
  }

  public getSupportedAreasIndexMap(duid: string): RoomIndexMap | undefined {
    return this.supportedAreaIndexMaps.get(duid);
  }

  public async getCleanModeData(duid: string): Promise<{ suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> {
    this.logger.notice('RoborockService - getCleanModeData');
    const data = await this.getMessageProcessor(duid)?.getCleanModeData(duid);
    if (!data) {
      throw new Error('Failed to retrieve clean mode data');
    }
    return data;
  }

  public async getRoomIdFromMap(duid: string): Promise<number | undefined> {
    const data = (await this.customGet(duid, new RequestMessage({ method: 'get_map_v1' }))) as { vacuumRoom?: number };
    return data?.vacuumRoom;
  }

  public async getMapInformation(duid: string): Promise<MapInfo | undefined> {
    this.logger.debug('RoborockService - getMapInformation', duid);
    assert(this.messageClient !== undefined);
    return this.messageClient.get<MultipleMap[] | undefined>(duid, new RequestMessage({ method: 'get_multi_maps_list' })).then((response) => {
      this.logger.debug('RoborockService - getMapInformation response', debugStringify(response ?? []));
      return response ? new MapInfo(response[0]) : undefined;
    });
  }

  public async changeCleanMode(
    duid: string,
    { suctionPower, waterFlow, distance_off, mopRoute }: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number },
  ): Promise<void> {
    this.logger.notice('RoborockService - changeCleanMode');
    return this.getMessageProcessor(duid)?.changeCleanMode(duid, suctionPower, waterFlow, mopRoute, distance_off);
  }

  public async startClean(duid: string): Promise<void> {
    const supportedRooms = this.supportedAreas.get(duid) ?? [];
    const supportedRoutines = this.supportedRoutines.get(duid) ?? [];
    const selected = this.selectedAreas.get(duid) ?? [];
    this.logger.debug('RoborockService - begin cleaning', debugStringify({ duid, supportedRooms, supportedRoutines, selected }));

    if (supportedRoutines.length === 0) {
      if (selected.length == supportedRooms.length || selected.length === 0 || supportedRooms.length === 0) {
        this.logger.debug('RoborockService - startGlobalClean');
        this.getMessageProcessor(duid)?.startClean(duid);
      } else {
        this.logger.debug('RoborockService - startRoomClean', debugStringify({ duid, selected }));
        return this.getMessageProcessor(duid)?.startRoomClean(duid, selected, 1);
      }
    } else {
      const rooms = selected.filter((slt) => supportedRooms.some((a: ServiceArea.Area) => a.areaId == slt));
      const rt = selected.filter((slt) => supportedRoutines.some((a: ServiceArea.Area) => a.areaId == slt));

      /**
       * If multiple routines are selected, we log a warning. and continue with global clean
       */
      if (rt.length > 1) {
        this.logger.warn('RoborockService - Multiple routines selected, which is not supported.', debugStringify({ duid, rt }));
      } else if (rt.length === 1) {
        this.logger.debug('RoborockService - startScene', debugStringify({ duid, rooms }));
        await this.iotApi?.startScene(rt[0]);
        return;
      } else if (rooms.length == supportedRooms.length || rooms.length === 0 || supportedRooms.length === 0) {
        /**
         * If no rooms are selected, or all selected rooms match the supported rooms,
         */
        this.logger.debug('RoborockService - startGlobalClean');
        this.getMessageProcessor(duid)?.startClean(duid);
      } else if (rooms.length > 0) {
        /**
         * If there are rooms selected
         */
        this.logger.debug('RoborockService - startRoomClean', debugStringify({ duid, rooms }));
        return this.getMessageProcessor(duid)?.startRoomClean(duid, rooms, 1);
      } else {
        this.logger.warn('RoborockService - something goes wrong.', debugStringify({ duid, rooms, rt, selected, supportedRooms, supportedRoutines }));
        return;
      }
    }
  }

  public async pauseClean(duid: string): Promise<void> {
    this.logger.debug('RoborockService - pauseClean');
    await this.getMessageProcessor(duid)?.pauseClean(duid);
  }

  public async stopAndGoHome(duid: string): Promise<void> {
    this.logger.debug('RoborockService - stopAndGoHome');
    await this.getMessageProcessor(duid)?.gotoDock(duid);
  }

  public async resumeClean(duid: string): Promise<void> {
    this.logger.debug('RoborockService - resumeClean');
    await this.getMessageProcessor(duid)?.resumeClean(duid);
  }

  public async playSoundToLocate(duid: string): Promise<void> {
    this.logger.debug('RoborockService - findMe');
    await this.getMessageProcessor(duid)?.findMyRobot(duid);
  }

  public async customGet(duid: string, request: RequestMessage): Promise<unknown> {
    this.logger.debug('RoborockService - customSend-message', request.method, request.params, request.secure);
    return this.getMessageProcessor(duid)?.getCustomMessage(duid, request);
  }

  public async customSend(duid: string, request: RequestMessage): Promise<void> {
    return this.getMessageProcessor(duid)?.sendCustomMessage(duid, request);
  }

  public async getCustomAPI(url: string): Promise<unknown> {
    this.logger.debug('RoborockService - getCustomAPI', url);
    assert(this.iotApi !== undefined);
    try {
      return await this.iotApi.getCustom(url);
    } catch (error) {
      this.logger.error(`Failed to get custom API with url ${url}: ${error ? debugStringify(error) : 'undefined'}`);
      return { result: undefined, error: `Failed to get custom API with url ${url}` };
    }
  }

  public stopService(): void {
    if (this.messageClient) {
      this.messageClient.disconnect();
      this.messageClient = undefined;
    }

    if (this.localClientMap.size > 0) {
      for (const [duid, client] of this.localClientMap.entries()) {
        this.logger.debug('Disconnecting local client for device', duid);
        client.disconnect();
        this.localClientMap.delete(duid);
        this.logger.debug('Local client disconnected for device', duid);
      }
    }

    if (this.messageProcessorMap.size > 0) {
      for (const [duid] of this.messageProcessorMap.entries()) {
        this.logger.debug('Disconnecting message processor for device', duid);
        this.messageProcessorMap.delete(duid);
        this.logger.debug('Message processor disconnected for device', duid);
      }
    }

    if (this.requestDeviceStatusInterval) {
      clearInterval(this.requestDeviceStatusInterval);
      this.requestDeviceStatusInterval = undefined;
    }
  }

  public setDeviceNotify(callback: (messageSource: NotifyMessageTypes, homeData: unknown) => Promise<void>): void {
    this.deviceNotify = callback;
  }

  public activateDeviceNotify(device: Device): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.logger.debug('Requesting device info for device', device.duid);
    const messageProcessor = this.getMessageProcessor(device.duid);
    this.requestDeviceStatusInterval = setInterval(async () => {
      if (messageProcessor) {
        await messageProcessor.getDeviceStatus(device.duid).then((response: DeviceStatus | undefined) => {
          if (self.deviceNotify && response) {
            const message = { duid: device.duid, ...response.errorStatus, ...response.message } as DeviceStatusNotify;
            self.logger.debug('Socket - Device status update', debugStringify(message));
            self.deviceNotify(NotifyMessageTypes.LocalMessage, message);
          }
        });
      } else {
        self.logger.error('Local client not initialized');
      }
    }, this.refreshInterval * 1000);
  }

  public activateDeviceNotifyOverMQTT(device: Device): void {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.logger.notice('Requesting device info for device over MQTT', device.duid);
    const messageProcessor = this.getMessageProcessor(device.duid);
    this.requestDeviceStatusInterval = setInterval(async () => {
      if (messageProcessor) {
        await messageProcessor.getDeviceStatusOverMQTT(device.duid).then((response: DeviceStatus | undefined) => {
          if (self.deviceNotify && response) {
            const message = { duid: device.duid, ...response.errorStatus, ...response.message } as DeviceStatusNotify;
            self.logger.debug('MQTT - Device status update', debugStringify(message));
            self.deviceNotify(NotifyMessageTypes.LocalMessage, message);
          }
        });
      } else {
        self.logger.error('Local client not initialized');
      }
    }, this.refreshInterval * 500);
  }

  public async listDevices(username: string): Promise<Device[]> {
    assert(this.iotApi !== undefined);
    assert(this.userdata !== undefined);

    const homeDetails = await this.loginApi.getHomeDetails();
    if (!homeDetails) {
      throw new Error('Failed to retrieve the home details');
    }

    const homeData = (await this.iotApi.getHome(homeDetails.rrHomeId)) as Home;
    if (!homeData) {
      return [];
    }

    const scenes = (await this.iotApi.getScenes(homeDetails.rrHomeId)) ?? [];

    const products = new Map<string, string>();
    homeData.products.forEach((p) => products.set(p.id, p.model));

    if (homeData.products.some((p) => this.vacuumNeedAPIV3.includes(p.model))) {
      this.logger.debug('Using v3 API for home data retrieval');
      const homeDataV3 = await this.iotApi.getHomev3(homeDetails.rrHomeId);
      if (!homeDataV3) {
        throw new Error('Failed to retrieve the home data from v3 API');
      }
      homeData.devices = [...homeData.devices, ...homeDataV3.devices.filter((d) => !homeData.devices.some((x) => x.duid === d.duid))];
      homeData.receivedDevices = [...homeData.receivedDevices, ...homeDataV3.receivedDevices.filter((d) => !homeData.receivedDevices.some((x) => x.duid === d.duid))];
    }

    // Try to get rooms from v2 API if rooms are empty
    if (homeData.rooms.length === 0) {
      const homeDataV2 = await this.iotApi.getHomev2(homeDetails.rrHomeId);
      if (homeDataV2 && homeDataV2.rooms && homeDataV2.rooms.length > 0) {
        homeData.rooms = homeDataV2.rooms;
      } else {
        const homeDataV3 = await this.iotApi.getHomev3(homeDetails.rrHomeId);
        if (homeDataV3 && homeDataV3.rooms && homeDataV3.rooms.length > 0) {
          homeData.rooms = homeDataV3.rooms;
        }
      }
    }

    const devices: Device[] = [...homeData.devices, ...homeData.receivedDevices];

    const result = devices.map((device) => {
      return {
        ...device,
        rrHomeId: homeDetails.rrHomeId,
        rooms: homeData.rooms,
        localKey: device.localKey,
        pv: device.pv,
        serialNumber: device.sn,
        scenes: scenes.filter((sc) => sc.param && (JSON.parse(sc.param) as SceneParam).action.items.some((x) => x.entityId == device.duid)),
        data: {
          id: device.duid,
          firmwareVersion: device.fv,
          serialNumber: device.sn,
          model: homeData.products.find((p) => p.id === device.productId)?.model,
          category: homeData.products.find((p) => p.id === device.productId)?.category,
          batteryLevel: device.deviceStatus?.[Protocol.battery] ?? 100,
        },

        store: {
          username: username,
          userData: this.userdata as UserData,
          localKey: device.localKey,
          pv: device.pv,
          model: products.get(device.productId),
        },
      };
    }) as Device[];

    return result;
  }

  public async getHomeDataForUpdating(homeid: number): Promise<Home> {
    assert(this.iotApi !== undefined);
    assert(this.userdata !== undefined);

    const homeData = await this.iotApi.getHomev2(homeid);

    if (!homeData) {
      throw new Error('Failed to retrieve the home data');
    }

    const products = new Map<string, string>();
    homeData.products.forEach((p) => products.set(p.id, p.model));
    const devices: Device[] = homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

    if (homeData.rooms.length === 0) {
      const homeDataV3 = await this.iotApi.getHomev3(homeid);
      if (homeDataV3 && homeDataV3.rooms && homeDataV3.rooms.length > 0) {
        homeData.rooms = homeDataV3.rooms;
      } else {
        const homeDataV1 = await this.iotApi.getHome(homeid);
        if (homeDataV1 && homeDataV1.rooms && homeDataV1.rooms.length > 0) {
          homeData.rooms = homeDataV1.rooms;
        }
      }
    }

    const dvs = devices.map((device) => {
      return {
        ...device,
        rrHomeId: homeid,
        rooms: homeData.rooms,
        serialNumber: device.sn,
        data: {
          id: device.duid,
          firmwareVersion: device.fv,
          serialNumber: device.sn,
          model: homeData.products.find((p) => p.id === device.productId)?.model,
          category: homeData.products.find((p) => p.id === device.productId)?.category,
          batteryLevel: device.deviceStatus?.[Protocol.battery] ?? 100,
        },

        store: {
          userData: this.userdata as UserData,
          localKey: device.localKey,
          pv: device.pv,
          model: products.get(device.productId),
        },
      };
    }) as Device[];

    return {
      ...homeData,
      devices: dvs,
    };
  }

  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    assert(this.iotApi !== undefined);
    return this.iotApi.getScenes(homeId);
  }

  public async startScene(sceneId: number): Promise<unknown> {
    assert(this.iotApi !== undefined);
    return this.iotApi.startScene(sceneId);
  }

  public async getRoomMappings(duid: string): Promise<number[][] | undefined> {
    if (!this.messageClient) {
      this.logger.warn('messageClient not initialized. Waititing for next execution');
      return Promise.resolve(undefined);
    }
    return this.messageClient.get(duid, new RequestMessage({ method: 'get_room_mapping', secure: this.isRequestSecure(duid) }));

    // return await this.getMessageProcessor(duid)?.getRooms(duid);
  }

  public async initializeMessageClient(username: string, device: Device, userdata: UserData): Promise<void> {
    if (this.clientManager === undefined) {
      this.logger.error('ClientManager not initialized');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.messageClient = this.clientManager.get(username, userdata);
    this.messageClient.registerDevice(device.duid, device.localKey, device.pv);

    this.messageClient.registerMessageListener({
      onMessage: (message: ResponseMessage) => {
        if (message instanceof ResponseMessage) {
          const duid = message.duid;

          // ignore battery updates here
          if (message.contain(Protocol.battery)) return;

          if (duid && self.deviceNotify) {
            self.deviceNotify(NotifyMessageTypes.CloudMessage, message);
          }
        }
      },
    } as AbstractMessageListener);

    this.messageClient.connect();

    while (!this.messageClient.isConnected()) {
      await this.sleep(500);
    }

    this.logger.debug('MessageClient connected');
  }

  public async initializeMessageClientForLocal(device: Device): Promise<boolean> {
    this.logger.debug('Begin get local ip');
    if (this.messageClient === undefined) {
      this.logger.error('messageClient not initialized');
      return false;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const messageProcessor = new MessageProcessor(this.messageClient);
    messageProcessor.injectLogger(this.logger);
    messageProcessor.registerListener({
      onError: (message: VacuumErrorCode) => {
        if (self.deviceNotify) {
          self.deviceNotify(NotifyMessageTypes.ErrorOccurred, { duid: device.duid, errorCode: message } as DeviceErrorMessage);
        }
      },
      onBatteryUpdate: (percentage: number) => {
        if (self.deviceNotify) {
          self.deviceNotify(NotifyMessageTypes.BatteryUpdate, { duid: device.duid, percentage } as BatteryMessage);
        }
      },
      onStatusChanged: () => {
        // status: DeviceStatus
        // if (self.deviceNotify) {
        //   const message: DeviceStatusNotify = { duid: device.duid, ...status.errorStatus, ...status.message } as DeviceStatusNotify;
        //   self.logger.debug('Device status update', debugStringify(message));
        //   self.deviceNotify(NotifyMessageTypes.LocalMessage, message);
        // }
      },
    } as AbstractMessageHandler);

    this.messageProcessorMap.set(device.duid, messageProcessor);

    this.logger.debug('Checking if device supports local connection', device.pv, device.data.model, device.duid);
    if (device.pv === 'B01') {
      this.logger.warn('Device does not support local connection', device.duid);
      this.mqttAlwaysOnDevices.set(device.duid, true);
      return true;
    } else {
      this.mqttAlwaysOnDevices.set(device.duid, false);
    }

    this.logger.debug('Local device', device.duid);
    let localIp = this.ipMap.get(device.duid);
    try {
      if (!localIp) {
        this.logger.debug('Requesting network info for device', device.duid);
        const networkInfo = await messageProcessor.getNetworkInfo(device.duid);
        if (!networkInfo || !networkInfo.ip) {
          this.logger.error('Failed to retrieve network info for device', device.duid, 'Network info:', networkInfo);
          return false;
        }

        this.logger.debug('Network ip for device', device.duid, 'is', networkInfo.ip);

        localIp = networkInfo.ip;
      }

      if (localIp) {
        this.logger.debug('initializing the local connection for this client towards ' + localIp);
        const localClient = this.messageClient.registerClient(device.duid, localIp) as LocalNetworkClient;
        localClient.connect();

        let count = 0;
        while (!localClient.isConnected() && count < 20) {
          this.logger.debug('Keep waiting for local client to connect');
          count++;
          await this.sleep(500);
        }

        if (!localClient.isConnected()) {
          throw new Error('Local client did not connect after 10 attempts, something is wrong');
        }

        this.ipMap.set(device.duid, localIp);
        this.localClientMap.set(device.duid, localClient);
        this.logger.debug('LocalClient connected');
      }
    } catch (error) {
      this.logger.error('Error requesting network info', error);
      return false;
    }

    return true;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private auth(userdata: UserData): UserData {
    this.userdata = userdata;
    this.iotApi = this.iotApiFactory(this.logger, userdata);
    return userdata;
  }

  private isRequestSecure(duid: string): boolean {
    return this.mqttAlwaysOnDevices.get(duid) ?? false;
  }
}
