import assert from 'node:assert';
import { AnsiLogger } from 'node-ansi-logger';
import ClientManager from './clientManager.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import RoborockAuthenticateApi from './roborockCommunication/RESTAPI/roborockAuthenticateApi.js';
import RoborockIoTApi from './roborockCommunication/RESTAPI/roborockIoTApi.js';
import MessageApi from './roborockCommunication/broadcast/messageAPI.js';
import UserData from './roborockCommunication/Zmodel/userData.js';
import Device from './roborockCommunication/Zmodel/device.js';
import { AbstractMessageHandler } from './roborockCommunication/broadcast/listener/abstractMessageHandler.js';
import { VacuumErrorCode } from './roborockCommunication/Zenum/vacuumAndDockErrorCode.js';
import { RequestMessage } from './roborockCommunication/broadcast/model/requestMessage.js';
import { Protocol } from './roborockCommunication/broadcast/model/protocol.js';
import { ClientRouter } from './roborockCommunication/broadcast/clientRouter.js';
import DeviceStatus from './roborockCommunication/Zmodel/deviceStatus.js';
import Home from './roborockCommunication/Zmodel/home.js';
import { ResponseMessage } from './roborockCommunication/broadcast/model/responseMessage.js';
import { AbstractConnectionListener, AbstractMessageListener } from './roborockCommunication/broadcast/listener/index.js';
export type Factory<A, T> = (logger: AnsiLogger, arg: A) => T;

export default class RoborockService {
  private loginApi: RoborockAuthenticateApi;
  private logger = new AnsiLogger({ logName: 'RoborockService' });
  private readonly iotApiFactory: Factory<UserData, RoborockIoTApi>;

  private iotApi?: RoborockIoTApi;
  private userdata?: UserData;
  deviceNotify?: (messageSource: NotifyMessageTypes, homeData: any) => void;
  messageClient: ClientRouter | undefined;
  remoteDevices: Set<string> = new Set();
  messageApi: MessageApi | undefined;
  ip: string | undefined;
  localClient: any;
  clientManager: ClientManager;
  refreshInterval: number;

  constructor(
    authenticateApiSupplier: Factory<void, RoborockAuthenticateApi> = (logger) => new RoborockAuthenticateApi(logger),
    iotApiSupplier: Factory<UserData, RoborockIoTApi> = (logger, ud) => new RoborockIoTApi(ud, logger),
    refreshInterval: number,
    clientManager: ClientManager,
    logger: AnsiLogger,
  ) {
    this.loginApi = authenticateApiSupplier(logger);
    this.iotApiFactory = iotApiSupplier;
    this.refreshInterval = refreshInterval;
    this.clientManager = clientManager;
  }

  public async loginWithPassword(username: string, password: string): Promise<UserData> {
    const userdata = await this.loginApi.loginWithPassword(username, password);
    return this.auth(userdata);
  }

  public getMessageApi(): MessageApi | undefined {
    if (!this.messageApi) {
      this.logger.error('MessageApi is not initialized');
    }

    return this.messageApi;
  }

  public async startClean(duid: string, selectedAreas: number[]): Promise<void> {
    if (selectedAreas.length == 0) {
      this.logger.notice('startGlobalClean');
      this.getMessageApi()?.startClean(duid);
    } else {
      return this.messageApi?.startRoomClean(duid, selectedAreas, 1);
    }
  }

  public async pauseClean(duid: string): Promise<void> {
    this.logger.notice('pauseClean');
    await this.getMessageApi()?.pauseClean(duid);
  }

  public async stopAndGoHome(duid: string): Promise<void> {
    this.logger.notice('stopAndGoHome');
    await this.getMessageApi()?.gotoDock(duid);
  }

  public async resumeClean(duid: string): Promise<void> {
    this.logger.notice('resumeClean');
    await this.getMessageApi()?.resumeClean(duid);
  }

  public async playSoundToLocate(duid: string): Promise<void> {
    this.logger.notice('findMe');
    await this.getMessageApi()?.findMyRobot(duid);
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

    if (this.messageApi) {
      this.messageApi = undefined;
    }
  }

  public setDeviceNotify(callback: (messageSource: NotifyMessageTypes, homeData: any) => Promise<void>): void {
    this.deviceNotify = callback;
  }

  public async activateDeviceNotify(device: Device): Promise<void> {
    await this.initializeMessageClientForLocal(device);
    const self = this;

    this.logger.debug('Requesting device info for device', device.duid);
    setInterval(async () => {
      if (this.messageApi) {
        await this.messageApi.getDeviceStatus(device.duid).then((response: DeviceStatus) => {
          if (self.deviceNotify) {
            self.deviceNotify(NotifyMessageTypes.LocalMessage, { duid: device.duid, ...response });
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

    const products = new Map<string, string>();
    homeData.products.forEach((p) => products.set(p.id, p.model));
    const devices: Device[] = homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

    const result = devices.map((device) => {
      return {
        ...device,
        rrHomeId: homeDetails.rrHomeId,
        rooms: homeData.rooms,
        localKey: device.localKey,
        pv: device.pv,
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
          username: username,
          userData: <UserData>this.userdata,
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
          userData: <UserData>this.userdata,
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

    const self = this;
    this.messageClient = this.clientManager.get(username, userdata, this.logger);
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

          //ignore battery updates here
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

    this.logger.debug('messageClient connected');
  }

  private async initializeMessageClientForLocal(device: Device): Promise<void> {
    this.logger.debug('Begin get local ip');
    if (this.messageClient === undefined) {
      this.logger.error('messageClient not initialized');
      return;
    }
    const self = this;

    this.messageApi = new MessageApi(this.messageClient);
    this.messageApi.registerListener({
      onError: (message: VacuumErrorCode) => {
        self.logger.error('MessageApi - onError', JSON.stringify(message));
      },
      onBatteryUpdate: (percentage: number) => {
        if (self.deviceNotify) {
          self.deviceNotify(NotifyMessageTypes.BatteryUpdate, { duid: device.duid, percentage });
        }
      },
    } as AbstractMessageHandler);

    this.logger.debug('Local device', device.duid);
    try {
      if (!this.ip) {
        this.logger.debug('Requesting network info for device', device.duid);
        const networkInfo = await this.messageApi.getNetworkInfo(device.duid);
        this.ip = networkInfo.ip;
      }

      if (this.ip) {
        this.logger.debug('initializing the local connection for this client towards ' + this.ip);
        this.localClient = this.messageClient.registerClient(device.duid, this.ip);
        this.localClient.connect();
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
