import { AnsiLogger } from 'matterbridge/logger';
import ClientManager from './clientManager.js';
import type { DeviceNotifyCallback } from '../types/index.js';
import { DeviceConnectionError, DeviceInitializationError, DeviceError } from '../errors/index.js';
import { CONNECTION_RETRY_DELAY_MS, MAX_CONNECTION_ATTEMPTS } from '../constants/index.js';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { Device, NetworkInfoDTO, Protocol, RPC_Request_Segments, UserData } from '../roborockCommunication/models/index.js';
import { MapResponseListener } from '../roborockCommunication/routing/listeners/implementation/mapResponseListener.js';
import { AbstractUDPMessageListener } from '../roborockCommunication/routing/listeners/abstractUDPMessageListener.js';
import { ProtocolVersion } from '../roborockCommunication/enums/index.js';
import { SimpleMessageHandler } from '../roborockCommunication/routing/handlers/implementation/simpleMessageHandler.js';
import { LocalNetworkUDPClient } from '../roborockCommunication/local/udpClient.js';
import { Client } from '../roborockCommunication/routing/client.js';
import { MessageRoutingService } from './messageRoutingService.js';
import { MessageDispatcherFactory } from '../roborockCommunication/protocol/dispatcher/dispatcherFactory.js';
import { SimpleMessageListener } from '../roborockCommunication/routing/listeners/implementation/simpleMessageListener.js';

/** Manages device connections (MQTT and local network). */
export class ConnectionService {
  clientRouter: ClientRouter | undefined;
  ipMap = new Map<string, string>();
  localClientMap = new Map<string, Client>();
  deviceNotify: DeviceNotifyCallback | undefined;

  constructor(
    private readonly clientManager: ClientManager,
    private readonly logger: AnsiLogger,
    private readonly messageRoutingService: MessageRoutingService,
  ) {}

  /** Set callback for device notifications. */
  public setDeviceNotify(callback: DeviceNotifyCallback): void {
    this.deviceNotify = callback;
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

  /**
   * Initialize the message client for cloud/MQTT communication.
   * Registers device, sets up message listeners, and waits for connection.
   */
  public async initializeMessageClient(device: Device, userdata: UserData): Promise<void> {
    if (!this.clientManager) {
      throw new DeviceInitializationError(device.duid, 'ClientManager not initialized');
    }

    try {
      this.clientRouter = this.clientManager.get(userdata);
      if (!this.clientRouter) {
        throw new DeviceInitializationError(device.duid, 'Failed to get ClientRouter from ClientManager');
      }

      this.logger.debug('Initializing message client for device:', device.duid);

      this.clientRouter.registerDevice(device.duid, device.localKey, device.pv, undefined);
      this.clientRouter.connect();

      // Wait for connection
      try {
        await this.waitForConnection(() => this.clientRouter?.isReady() ?? false);
        device.specs.hasRealTimeConnection = true;
      } catch {
        throw new DeviceConnectionError(device.duid, 'MQTT connection timeout');
      }

      this.logger.debug('clientRouter connected for device:', device.duid);
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

    if (!this.clientRouter) {
      this.logger.error('clientRouter not initialized');
      return false;
    }

    if (!this.deviceNotify) {
      this.logger.error('deviceNotify callback not set');
      return false;
    }

    this.clientRouter.registerMessageListener(new MapResponseListener(device.duid, this.logger));

    const simpleMessageListener = new SimpleMessageListener(device.duid, this.logger);
    simpleMessageListener.registerHandler(new SimpleMessageHandler(device.duid, this.logger, this.deviceNotify));
    this.clientRouter.registerMessageListener(simpleMessageListener);

    const store = device.store;
    const messageDispatcher = new MessageDispatcherFactory(this.clientRouter, this.logger).getMessageDispatcher(store.pv, store.model);

    // Register message listeners
    this.messageRoutingService.registerMessageDispatcher(device.duid, messageDispatcher);

    // B01 devices use MQTT-only communication
    if (device.pv === ProtocolVersion.B01) {
      this.logger.debug(`Device: ${device.duid} uses B01 protocol, switch to use UDPClient`);
      const localNetworkUDPClient = new LocalNetworkUDPClient(this.logger);

      const networkInfo = this.getNetworkInfoFromDeviceStatus(device);

      if (networkInfo?.ipAddress) {
        this.logger.debug(`Device ${device.duid} has network info IP: ${networkInfo.ipAddress}, setting up UDP listener`);
        const success = await this.setupLocalClient(device, networkInfo.ipAddress);
        if (success) {
          return true;
        }

        this.logger.error(`Failed to set up local client for device ${device.duid} at IP ${networkInfo.ipAddress} via B01 setup.
            Continuing to listen for broadcasts.`);
      }

      localNetworkUDPClient.registerListener({
        onMessage: async (duid: string, ip: string): Promise<void> => {
          this.logger.debug(`Received UDP broadcast from device ${duid} at IP ${ip}`);
          await this.setupLocalClient(device, ip);
        },
      } as AbstractUDPMessageListener);

      localNetworkUDPClient.connect();
      return true;
    }

    // Get device IP address from network info
    let localIp = this.ipMap.get(device.duid);

    if (!localIp) {
      this.logger.debug(`Device ${device.duid} IP not cached, fetching from device`);
      const networkInfo = await messageDispatcher.getNetworkInfo(device.duid);

      if (!networkInfo?.ip) {
        this.logger.warn('Failed to get network info, using MQTT only for device:', device.duid);
        return false;
      }

      this.logger.debug(`Device ${device.duid} is on local network, attempting local connection at IP ${networkInfo.ip}`);
      localIp = networkInfo.ip;
    }

    if (localIp) {
      return await this.setupLocalClient(device, localIp);
    }

    return false;
  }

  /**
   * Get the current message client instance.
   * @returns The active ClientRouter or undefined if not initialized
   */
  getMessageClient(): ClientRouter | undefined {
    return this.clientRouter;
  }

  /**
   * Shutdown all connections and cleanup resources.
   */
  async shutdown(): Promise<void> {
    // Disconnect main message client
    if (this.clientRouter) {
      try {
        this.clientRouter.disconnect();
      } catch (error) {
        this.logger.error('Error disconnecting message client:', error);
      }
      this.clientRouter = undefined;
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

    this.clientRouter = undefined;
    this.deviceNotify = undefined;
  }

  /**
   * Sleep for specified milliseconds.
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Set up a local client for the given device and IP.
   */
  private async setupLocalClient(device: Device, ip: string): Promise<boolean> {
    if (!this.clientRouter) {
      this.logger.error('clientRouter not initialized');
      return false;
    }

    try {
      const localClient = this.clientRouter.registerClient(device.duid, ip);
      if (!localClient) {
        this.logger.error(`Failed to create local client for device ${device.duid} at IP ${ip}`);
        return false;
      }

      localClient.connect();
      await this.waitForConnection(() => localClient.isReady());

      device.specs.hasRealTimeConnection = true;

      this.ipMap.set(device.duid, ip);
      this.localClientMap.set(device.duid, localClient);
      this.logger.debug(`Local connection established for device ${device.duid} at ${ip}`);
      return true;
    } catch (error) {
      this.logger.error(`Error setting up local client for device ${device.duid} at IP ${ip}:`, error);
      return false;
    }
  }

  /**
   * Extract network info from device status.
   */
  private getNetworkInfoFromDeviceStatus(device: Device): NetworkInfoDTO | undefined {
    const rpcRequest = device.deviceStatus?.[Protocol.rpc_request];
    if (!rpcRequest) return undefined;

    return (rpcRequest as Record<number, unknown>)[RPC_Request_Segments.network_info] as NetworkInfoDTO | undefined;
  }
}
