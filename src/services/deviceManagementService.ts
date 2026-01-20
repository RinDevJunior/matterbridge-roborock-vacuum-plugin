import { AnsiLogger } from 'matterbridge/logger';
import {
  Device,
  Home,
  Protocol,
  UserData,
  RoborockIoTApi,
  RoborockAuthenticateApi,
  ClientRouter,
  MessageProcessor,
  Client,
  SceneParam,
  PingResponseListener,
  StatusMessageListener,
  ProtocolVersion,
  SimpleMessageHandler,
  MapResponseListener,
  LocalNetworkUDPClient,
  AbstractUDPMessageListener,
} from '@/roborockCommunication/index.js';
import type { DeviceNotifyCallback, Factory } from '@/types/index.js';
import { DeviceError, DeviceNotFoundError, DeviceConnectionError, DeviceInitializationError } from '@/errors/index.js';
import { CONNECTION_RETRY_DELAY_MS, MAX_CONNECTION_ATTEMPTS } from '@/constants/index.js';
import { MessageRoutingService, ClientManager } from './index.js';

/** Handles device discovery, initialization, and lifecycle. */
export class DeviceManagementService {
  // State management
  messageClient: ClientRouter | undefined;
  ipMap = new Map<string, string>();
  localClientMap = new Map<string, Client>();

  private deviceNotify: DeviceNotifyCallback | undefined;

  constructor(
    private readonly iotApiFactory: Factory<UserData, RoborockIoTApi>,
    private readonly clientManager: ClientManager,
    private readonly logger: AnsiLogger,
    private readonly loginApi: RoborockAuthenticateApi,
    private readonly messageRoutingService: MessageRoutingService,
    private iotApi?: RoborockIoTApi,
    private userdata?: UserData,
  ) {}

  /** Set callback for device status updates. */
  public setDeviceNotify(callback?: DeviceNotifyCallback): void {
    this.deviceNotify = callback;
  }

  /** Set IoT API instance after authentication. */
  public setAuthentication(userdata: UserData): void {
    this.userdata = userdata;
    this.iotApi = this.iotApiFactory(this.logger, userdata);
  }

  /** Wait for connection with retry logic. Returns attempt count. */
  public async waitForConnection(checkConnection: () => boolean, maxAttempts = MAX_CONNECTION_ATTEMPTS, delayMs = CONNECTION_RETRY_DELAY_MS): Promise<number> {
    let attempts = 0;
    while (!checkConnection() && attempts < maxAttempts) {
      await this.sleep(delayMs);
      attempts++;
    }

    if (!checkConnection()) {
      throw new Error(`Connection timeout after ${attempts} attempts`);
    }

    return attempts;
  }

  /** List all devices for a user (enriched with rooms, scenes, metadata). */
  public async listDevices(username: string): Promise<Device[]> {
    if (!this.iotApi || !this.userdata) {
      throw new DeviceError('Not authenticated. Please login first.');
    }

    try {
      this.logger.debug('Fetching home details for user:', username);
      const homeDetails = await this.loginApi.getHomeDetails();

      if (!homeDetails || !homeDetails.rrHomeId) {
        throw new DeviceNotFoundError('No home found for user');
      }

      const homeData = await this.iotApi.getHomeWithProducts(homeDetails.rrHomeId);
      if (!homeData) {
        throw new DeviceError('Failed to retrieve home data', undefined, { homeId: homeDetails.rrHomeId });
      }

      this.logger.debug(`Processing home data for home ID: ${homeDetails.rrHomeId}`);

      const products = new Map<string, string>();
      homeData.products.forEach((p) => products.set(p.id, p.model));

      const devices: Device[] = homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

      // Fetch scenes for routine support
      const scenes = (await this.iotApi.getScenes(homeDetails.rrHomeId)) ?? [];

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

      const products = new Map<string, string>();
      homeData.products.forEach((p) => products.set(p.id, p.model));
      const devices: Device[] = homeData.devices.length > 0 ? homeData.devices : homeData.receivedDevices;

      // Fallback to older API versions if rooms are missing
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
    } catch (error) {
      this.logger.error('Failed to get home data for updating:', error);
      return undefined;
    }
  }

  /**
   * Initialize the message client for cloud/MQTT communication.
   * Registers device, sets up message listeners, and waits for connection.
   */
  public async initializeMessageClient(username: string, device: Device, userdata: UserData): Promise<void> {
    if (!this.clientManager) {
      throw new DeviceInitializationError(device.duid, 'ClientManager not initialized');
    }

    try {
      this.messageClient = this.clientManager.get(username, userdata);
      this.messageClient.registerDevice(device.duid, device.localKey, device.pv, undefined);

      this.messageClient.registerMessageListener(new StatusMessageListener(device.duid, this.logger, this.deviceNotify?.bind(this)));
      this.messageClient.registerMessageListener(new PingResponseListener(device.duid));
      this.messageClient.registerMessageListener(new MapResponseListener(device.duid, this.logger));

      this.messageClient.connect();

      // Wait for connection
      try {
        await this.waitForConnection(() => this.messageClient?.isConnected() ?? false);
      } catch {
        throw new DeviceConnectionError(device.duid, 'MQTT connection timeout');
      }

      this.logger.debug('MessageClient connected for device:', device.duid);
    } catch (error) {
      this.logger.error('Failed to initialize message client:', error);
      if (error instanceof DeviceError) {
        throw error;
      }
      throw new DeviceInitializationError(device.duid, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Initialize local network client for direct device communication.
   * Creates message processor, retrieves device IP, and establishes local connection.
   * Devices with protocol version B01 will skip local connection and use MQTT only.
   */
  public async initializeMessageClientForLocal(device: Device): Promise<boolean> {
    this.logger.debug('Initializing local network client for device:', device.duid);

    if (!this.messageClient) {
      this.logger.error('messageClient not initialized');
      return false;
    }

    const messageProcessor = new MessageProcessor(this.messageClient);
    messageProcessor.injectLogger(this.logger);

    // Register message listeners
    messageProcessor.registerListener(new SimpleMessageHandler(device.duid, this.deviceNotify?.bind(this)));
    this.messageRoutingService.registerMessageProcessor(device.duid, messageProcessor);

    // B01 devices use MQTT-only communication
    if (device.pv === ProtocolVersion.B01) {
      this.logger.debug(`Device: ${device.duid} uses B01 protocol, switch to use UDPClient`);
      this.messageRoutingService.setMqttAlwaysOn(device.duid, true);
      const localNetworkUDPClient = new LocalNetworkUDPClient(this.logger);

      localNetworkUDPClient.registerListener({
        onMessage: async (duid: string, ip: string): Promise<void> => {
          try {
            this.logger.debug(`Received UDP broadcast from device ${duid} at IP ${ip}`);
            this.ipMap.set(duid, ip);
            const localClient = this.messageClient?.registerClient(duid, ip);
            if (!localClient) {
              this.logger.error(`Failed to create local client for device ${duid} at IP ${ip} via UDPMessageListener`);
              return;
            }

            localClient.connect();
            await this.waitForConnection(() => localClient.isConnected());

            this.localClientMap.set(duid, localClient);
            this.logger.debug(`Local connection established for device ${duid} at ${ip} via UDPMessageListener`);
          } catch (error) {
            this.logger.error(`Error handling UDP message for device ${duid} at IP ${ip}:`, error);
          }
        },
      } as AbstractUDPMessageListener);

      localNetworkUDPClient.connect();
      return true;
    }

    try {
      // Get device IP address from network info
      let localIp = this.ipMap.get(device.duid);

      if (!localIp) {
        this.logger.debug(`Device ${device.duid} IP not cached, fetching from device`);
        const networkInfo = await messageProcessor.getNetworkInfo(device.duid);

        if (!networkInfo || !networkInfo.ip) {
          this.logger.warn('Failed to get network info, using MQTT only for device:', device.duid);
          return false;
        }

        this.logger.debug(`Device ${device.duid} is on local network, attempting local connection at IP ${networkInfo.ip}`);
        localIp = networkInfo.ip;
      }

      if (localIp) {
        // Create local network client via messageClient
        this.logger.debug(`Initializing local connection for device ${device.duid} at IP ${localIp}`);
        const localClient = this.messageClient.registerClient(device.duid, localIp);
        localClient.connect();

        // Wait for connection
        try {
          await this.waitForConnection(() => localClient.isConnected());
        } catch {
          throw new DeviceConnectionError(device.duid, `Local client did not connect: ${localIp} via LocalNetworkClient`);
        }

        this.ipMap.set(device.duid, localIp);
        this.localClientMap.set(device.duid, localClient);
        this.logger.debug(`Local connection established for device ${device.duid} at ${localIp}`);
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to initialize local connection:', error);
      return false;
    }
  }

  /**
   * Stop the service and clean up all resources.
   * Disconnects all clients, clears intervals, and resets internal state.
   */
  public stopService(): void {
    // Disconnect main message client
    if (this.messageClient) {
      try {
        this.messageClient.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting message client:', error);
      }
      this.messageClient = undefined;
    }

    // Disconnect all local clients
    for (const [duid, client] of this.localClientMap) {
      try {
        this.logger.debug('Disconnecting local client:', duid);
        client.disconnect();
      } catch (error) {
        this.logger.error(`Error disconnecting local client ${duid}:`, error);
      }
    }

    // Clear all state
    this.localClientMap.clear();
    this.ipMap.clear();
    this.messageRoutingService.clearAll();

    this.logger.notice('Device management service stopped');
  }

  /**
   * Helper: Sleep for specified milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
