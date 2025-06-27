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
} from './roborockCommunication/index.js';
import type {
  AbstractMessageHandler,
  AbstractMessageListener,
  AbstractConnectionListener,
  BatteryMessage,
  DeviceErrorMessage,
  DeviceStatusNotify,
} from './roborockCommunication/index.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { LocalNetworkClient } from './roborockCommunication/broadcast/client/LocalNetworkClient.js';
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
  messageProcessor: MessageProcessor | undefined;
  ip: string | undefined;
  localClient: Client | undefined;
  clientManager: ClientManager;
  refreshInterval: number;
  requestDeviceStatusInterval: NodeJS.Timeout | undefined;

  // These are properties that are used to store the state of the device
  private supportedAreas = new Map<string, ServiceArea.Area[]>();
  private supportedRoutines = new Map<string, ServiceArea.Area[]>();
  private selectedAreas = new Map<string, number[]>();

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

  public async loginWithPassword(username: string, password: string): Promise<UserData> {
    const userdata = await this.loginApi.loginWithPassword(username, password);
    return this.auth(userdata);
  }

  public getMessageProcessor(): MessageProcessor | undefined {
    if (!this.messageProcessor) {
      this.logger.error('MessageApi is not initialized.');
    }
    return this.messageProcessor;
  }

  public setSelectedAreas(duid: string, selectedAreas: number[]): void {
    this.logger.debug('RoborockService - setSelectedAreas', selectedAreas);
    this.selectedAreas.set(duid, selectedAreas);
  }

  public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
    this.supportedAreas.set(duid, supportedAreas);
  }

  public setSupportedScenes(duid: string, routineAsRooms: ServiceArea.Area[]) {
    this.supportedRoutines.set(duid, routineAsRooms);
  }

  public getSupportedAreas(duid: string): ServiceArea.Area[] | undefined {
    return this.supportedAreas.get(duid);
  }

  public async getCleanModeData(duid: string): Promise<{ suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number }> {
    this.logger.notice('RoborockService - getCleanModeData');
    const data = await this.messageProcessor?.getCleanModeData(duid);
    if (!data) {
      throw new Error('Failed to retrieve clean mode data');
    }
    return data;
  }

  public async changeCleanMode(
    duid: string,
    { suctionPower, waterFlow, distance_off, mopRoute }: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number },
  ): Promise<void> {
    this.logger.notice('RoborockService - changeCleanMode');
    return this.messageProcessor?.changeCleanMode(duid, suctionPower, waterFlow, mopRoute, distance_off);
  }

  public async startClean(duid: string): Promise<void> {
    const supportedRooms = this.supportedAreas.get(duid) ?? [];
    const supportedRoutines = this.supportedRoutines.get(duid) ?? [];
    const selected = this.selectedAreas.get(duid) ?? [];
    this.logger.debug('RoborockService - begin cleaning', debugStringify({ duid, supportedRooms, supportedRoutines, selected }));

    if (supportedRoutines.length === 0) {
      if (selected.length == supportedRooms.length || selected.length === 0 || supportedRooms.length === 0) {
        this.logger.debug('RoborockService - startGlobalClean');
        this.getMessageProcessor()?.startClean(duid);
      } else {
        this.logger.debug('RoborockService - startRoomClean', debugStringify({ duid, selected }));
        return this.messageProcessor?.startRoomClean(duid, selected, 1);
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
        this.getMessageProcessor()?.startClean(duid);
      } else if (rooms.length > 0) {
        /**
         * If there are rooms selected
         */
        this.logger.debug('RoborockService - startRoomClean', debugStringify({ duid, rooms }));
        return this.messageProcessor?.startRoomClean(duid, rooms, 1);
      } else {
        this.logger.warn('RoborockService - something goes wrong.', debugStringify({ duid, rooms, rt, selected, supportedRooms, supportedRoutines }));
        return;
      }
    }
  }

  public async pauseClean(duid: string): Promise<void> {
    this.logger.debug('RoborockService - pauseClean');
    await this.getMessageProcessor()?.pauseClean(duid);
  }

  public async stopAndGoHome(duid: string): Promise<void> {
    this.logger.debug('RoborockService - stopAndGoHome');
    await this.getMessageProcessor()?.gotoDock(duid);
  }

  public async resumeClean(duid: string): Promise<void> {
    this.logger.debug('RoborockService - resumeClean');
    await this.getMessageProcessor()?.resumeClean(duid);
  }

  public async playSoundToLocate(duid: string): Promise<void> {
    this.logger.debug('RoborockService - findMe');
    await this.getMessageProcessor()?.findMyRobot(duid);
  }

  public async customGet(duid: string, method: string): Promise<unknown> {
    this.logger.debug('RoborockService - customSend-message', method);
    return this.getMessageProcessor()?.getCustomMessage(duid, new RequestMessage({ method }));
  }

  public async customGetInSecure(duid: string, method: string): Promise<unknown> {
    this.logger.debug('RoborockService - customGetInSecure-message', method);
    return this.getMessageProcessor()?.getCustomMessage(duid, new RequestMessage({ method, secure: true }));
  }

  public async customSend(duid: string, request: RequestMessage): Promise<void> {
    return this.getMessageProcessor()?.sendCustomMessage(duid, request);
  }

  public stopService(): void {
    if (this.messageClient) {
      this.messageClient.disconnect();
      this.messageClient = undefined;
    }

    if (this.localClient) {
      this.localClient.disconnect();
      this.localClient = undefined;
    }

    if (this.messageProcessor) {
      this.messageProcessor = undefined;
    }

    if (this.requestDeviceStatusInterval) {
      clearInterval(this.requestDeviceStatusInterval);
      this.requestDeviceStatusInterval = undefined;
    }
  }

  public setDeviceNotify(callback: (messageSource: NotifyMessageTypes, homeData: unknown) => Promise<void>): void {
    this.deviceNotify = callback;
  }

  public async activateDeviceNotify(device: Device): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.logger.debug('Requesting device info for device', device.duid);
    this.requestDeviceStatusInterval = setInterval(async () => {
      if (this.messageProcessor) {
        await this.messageProcessor.getDeviceStatus(device.duid).then((response: DeviceStatus) => {
          if (self.deviceNotify) {
            const message: DeviceStatusNotify = { duid: device.duid, ...response.errorStatus, ...response.message } as DeviceStatusNotify;
            self.logger.debug('Device status update', debugStringify(message));
            self.deviceNotify(NotifyMessageTypes.LocalMessage, message);
          }
        });
      } else {
        self.logger.error('Local client not initialized');
      }
    }, this.refreshInterval * 1000);
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
    const devices: Device[] = [...homeData.devices, ...homeData.receivedDevices];
    // homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

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

  public getRoomMappings(duid: string): Promise<number[][]> | undefined {
    if (!this.messageClient) {
      this.logger.warn('messageClient not initialized. Waititing for next execution');
      return undefined;
    }

    return this.messageClient.get(duid, new RequestMessage({ method: 'get_room_mapping' }));
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
    this.messageClient.registerConnectionListener({
      onConnected: () => {
        self.logger.notice('Connected to MQTT broker');
      },
      onDisconnected: () => {
        self.logger.notice('Disconnected from MQTT broker');
      },
      onError: (message: string) => {
        self.logger.error('Error from MQTT broker', message);
      },
    } as AbstractConnectionListener);

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

  public async initializeMessageClientForLocal(device: Device): Promise<void> {
    this.logger.debug('Begin get local ip');
    if (this.messageClient === undefined) {
      this.logger.error('messageClient not initialized');
      return;
    }
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.messageProcessor = new MessageProcessor(this.messageClient);
    this.messageProcessor.injectLogger(this.logger);
    this.messageProcessor.registerListener({
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
      onStatusChanged: (status: DeviceStatus) => {
        // if (self.deviceNotify) {
        //   const message: DeviceStatusNotify = { duid: device.duid, ...status.errorStatus, ...status.message } as DeviceStatusNotify;
        //   self.logger.debug('Device status update', debugStringify(message));
        //   self.deviceNotify(NotifyMessageTypes.LocalMessage, message);
        // }
      },
    } as AbstractMessageHandler);

    this.logger.debug('Local device', device.duid);
    try {
      if (!this.ip) {
        this.logger.debug('Requesting network info for device', device.duid);
        const networkInfo = await this.messageProcessor.getNetworkInfo(device.duid);
        this.ip = networkInfo.ip;
      }

      if (this.ip) {
        this.logger.debug('initializing the local connection for this client towards ' + this.ip);
        this.localClient = this.messageClient.registerClient(device.duid, this.ip) as LocalNetworkClient;
        this.localClient.connect();

        let count = 0;
        while (!this.localClient.isConnected() && count < 20) {
          this.logger.debug('Keep waiting for local client to connect');
          count++;
          await this.sleep(500);
        }

        if (!this.localClient.isConnected()) {
          throw new Error('Local client did not connect after 10 attempts, something is wrong');
        }

        this.logger.debug('LocalClient connected');
      }
    } catch (error) {
      this.logger.error('Error requesting network info', error);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private auth(userdata: UserData): UserData {
    this.userdata = userdata;
    this.iotApi = this.iotApiFactory(this.logger, userdata);
    return userdata;
  }
}
