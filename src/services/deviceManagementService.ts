import { AnsiLogger } from 'matterbridge/logger';
import { DeviceError, DeviceNotFoundError } from '../errors/index.js';
import { Device, DeviceData, DeviceInformation, DeviceModel, Home, Protocol, SceneParam, UserData } from '../roborockCommunication/models/index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { DeviceCategory } from '../roborockCommunication/models/deviceCategory.js';

/** Handles device discovery, initialization, and lifecycle. */
export class DeviceManagementService {
  private iotApi: RoborockIoTApi | undefined;
  constructor(
    private readonly logger: AnsiLogger,
    private readonly loginApi: RoborockAuthenticateApi,
    private userdata: UserData | undefined,
  ) {}

  public setIotApi(iotApi: RoborockIoTApi): void {
    this.iotApi = iotApi;
  }

  /** Set IoT API instance after authentication. */
  public setAuthentication(userdata: UserData): void {
    this.userdata = userdata;
  }

  /** List all devices for a user (enriched with rooms, scenes, metadata). */
  public async listDevices(): Promise<Device[]> {
    if (!this.iotApi || !this.userdata) {
      throw new DeviceError('Not authenticated. Please login first.');
    }

    try {
      this.logger.debug('Fetching home details for user:', this.userdata.username);
      const homeInfo = await this.loginApi.getBasicHomeInfo();

      if (!homeInfo?.rrHomeId) {
        throw new DeviceNotFoundError('No home found for user');
      }

      const homeData = await this.iotApi.getHomeWithProducts(homeInfo.rrHomeId);
      if (!homeData) {
        throw new DeviceError('Failed to retrieve home data', undefined, { homeId: homeInfo.rrHomeId });
      }

      this.logger.debug(`Processing home data for home ID: ${homeInfo.rrHomeId}`);

      const products = homeData.products.reduce((map, p) => {
        map.set(p.id, { model: p.model as DeviceModel, category: p.category as DeviceCategory });
        return map;
      }, new Map<string, { model: DeviceModel; category: DeviceCategory }>());

      // Fetch scenes for routine support
      const scenes = (await this.iotApi.getScenes(homeInfo.rrHomeId)) ?? [];

      const result = homeData.allDevices.map((device) => {
        return {
          ...device,
          rrHomeId: homeInfo.rrHomeId,
          rooms: homeData.rooms,
          localKey: device.localKey,
          pv: device.pv,
          serialNumber: device.sn,
          scenes: scenes.filter((sc) => sc.param && (JSON.parse(sc.param) as SceneParam).action.items.some((x) => x.entityId == device.duid)),
          data: {
            id: device.duid,
            firmwareVersion: device.fv,
            serialNumber: device.sn,
            model: products.get(device.productId)?.model as DeviceModel,
            category: products.get(device.productId)?.category as DeviceCategory,
            batteryLevel: Number(device.deviceStatus?.[Protocol.battery] ?? 100),
          } satisfies DeviceData,
          store: {
            userData: this.userdata as UserData,
            localKey: device.localKey,
            pv: device.pv,
            model: products.get(device.productId)?.model as DeviceModel,
          } satisfies DeviceInformation,
        };
      }) satisfies Device[];

      this.logger.notice(`Found ${result.length} devices`);
      return result;
    } catch (error) {
      this.logger.error('Failed to list devices:', error);
      if (error instanceof DeviceError) {
        throw error;
      }
      throw new DeviceError('Failed to retrieve device list', undefined, {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Get home data for periodic updates (falls back to v3/v1 APIs if needed). */
  public async getHomeDataForUpdating(homeid: number): Promise<Home | undefined> {
    if (!this.iotApi || !this.userdata) {
      this.logger.error('Not authenticated');
      return undefined;
    }

    try {
      const homeData = await this.iotApi.getHomev2(homeid);

      if (!homeData) {
        return undefined;
      }

      const products = new Map<string, { model: DeviceModel; category: DeviceCategory }>();
      homeData.products.forEach((p) => products.set(p.id, { model: p.model as DeviceModel, category: p.category as DeviceCategory }));
      const devices: Device[] = homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

      // Fallback to older API versions if rooms are missing
      if (homeData.rooms.length === 0) {
        const homeDataV3 = await this.iotApi.getHomev3(homeid);
        if (homeDataV3?.rooms && homeDataV3.rooms.length > 0) {
          homeData.rooms = homeDataV3.rooms;
        } else {
          const homeDataV1 = await this.iotApi.getHome(homeid);
          if (homeDataV1?.rooms && homeDataV1.rooms.length > 0) {
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
            model: products.get(device.productId)?.model as DeviceModel,
            category: products.get(device.productId)?.category as DeviceCategory,
            batteryLevel: Number(device.deviceStatus?.[Protocol.battery] ?? 100),
          } satisfies DeviceData,
          store: {
            userData: this.userdata as UserData,
            localKey: device.localKey,
            pv: device.pv,
            model: products.get(device.productId)?.model as DeviceModel,
          } satisfies DeviceInformation,
        };
      }) satisfies Device[];
      return new Home(homeData.id, homeData.name, homeData.products, dvs, homeData.receivedDevices, homeData.rooms);
    } catch (error) {
      this.logger.error('Failed to get home data for updating:', error);
      return undefined;
    }
  }

  /**
   * Stop the service and clean up all resources.
   * Disconnects all clients, clears intervals, and resets internal state.
   */
  public stopService(): void {
    this.logger.notice('Device management service stopped');
    this.iotApi = undefined;
    this.userdata = undefined;
  }
}
