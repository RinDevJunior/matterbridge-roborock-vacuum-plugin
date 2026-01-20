import { AnsiLogger } from 'matterbridge/logger';
import { ClientManager } from './index.js';
import { DpsPayload, LocalNetworkClient, Device, UserData, ClientRouter, Protocol, ResponseMessage, AbstractMessageListener } from '@/roborockCommunication/index.js';
import type { DeviceNotifyCallback, Security } from '@/types/index.js';
import { DeviceConnectionError, DeviceInitializationError, DeviceError } from '@/errors/index.js';
import { CONNECTION_RETRY_DELAY_MS, MAX_CONNECTION_ATTEMPTS } from '@/constants/index.js';
import { NotifyMessageTypes } from '@/notifyMessageTypes.js';

/** Manages device connections (MQTT and local network). */
export class ConnectionService {
  messageClient: ClientRouter | undefined;
  deviceNotify?: DeviceNotifyCallback;

  constructor(
    private readonly clientManager: ClientManager,
    private readonly logger: AnsiLogger,
  ) {}

  /** Set callback for device notifications. */
  setDeviceNotify(callback: DeviceNotifyCallback): void {
    this.deviceNotify = callback;
  }

  /** Wait for connection with retry logic. Returns attempt count. */
  async waitForConnection(checkConnection: () => boolean, maxAttempts = MAX_CONNECTION_ATTEMPTS, delayMs = CONNECTION_RETRY_DELAY_MS): Promise<number> {
    for (let attempts = 0; attempts < maxAttempts; attempts++) {
      if (checkConnection()) {
        return attempts;
      }
      await this.sleep(delayMs);
    }

    // Final check after all retries
    if (checkConnection()) {
      return maxAttempts;
    }

    throw new Error(`Connection timeout after ${maxAttempts} attempts`);
  }

  /** Initialize MQTT client for cloud communication. */
  async initializeMessageClient(username: string, device: Device, userdata: UserData): Promise<void> {
    if (!this.clientManager) {
      throw new DeviceInitializationError(device.duid, 'ClientManager not initialized');
    }

    try {
      this.messageClient = this.clientManager.get(username, userdata);
      this.messageClient.registerDevice(device.duid, device.localKey, device.pv, undefined);

      this.messageClient.registerMessageListener({
        onMessage: (message: ResponseMessage) => {
          if (message instanceof ResponseMessage) {
            const duid = message.duid;

            // ignore battery updates here
            if (message.isForProtocol(Protocol.battery)) return;

            if (duid && this.deviceNotify) {
              this.deviceNotify(NotifyMessageTypes.CloudMessage, message);
            }
          }

          if (message instanceof ResponseMessage && message.isForProtocol(Protocol.hello_response)) {
            const dps = message.get<DpsPayload>(Protocol.hello_response);
            const result = dps.result as Security;
            this.messageClient?.updateNonce(message.duid, result.nonce);
          }
        },
      } as AbstractMessageListener);

      this.messageClient.connect();

      // Wait for connection
      try {
        await this.waitForConnection(() => this.messageClient?.isConnected() ?? false, MAX_CONNECTION_ATTEMPTS, CONNECTION_RETRY_DELAY_MS);
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
   * Register a local network client for direct UDP communication.
   * Creates and connects a local client, waits for connection establishment.
   * @param device - Device to connect to
   * @param localIp - Local IP address of the device
   * @returns The connected local network client
   * @throws {DeviceConnectionError} If local connection fails
   */
  async registerLocalClient(device: Device, localIp: string): Promise<LocalNetworkClient> {
    if (!this.messageClient) {
      throw new DeviceConnectionError(device.duid, 'Message client not initialized');
    }

    this.logger.debug('Initializing the local connection for this client towards ' + localIp);
    const localClient = this.messageClient.registerClient(device.duid, localIp) as LocalNetworkClient;
    localClient.connect();

    // Wait for connection
    try {
      await this.waitForConnection(() => localClient.isConnected(), MAX_CONNECTION_ATTEMPTS, CONNECTION_RETRY_DELAY_MS);
    } catch {
      throw new DeviceConnectionError(device.duid, `Local client did not connect`, { ip: localIp });
    }

    this.logger.notice(`Local connection established for device ${device.duid} at ${localIp}`);
    return localClient;
  }

  /**
   * Get the current message client instance.
   * @returns The active ClientRouter or undefined if not initialized
   */
  getMessageClient(): ClientRouter | undefined {
    return this.messageClient;
  }

  /**
   * Shutdown all connections and cleanup resources.
   */
  async shutdown(): Promise<void> {
    // Connections are managed by ClientManager, nothing to do here
    this.messageClient = undefined;
    this.deviceNotify = undefined;
  }

  /**
   * Sleep for specified milliseconds.
   * @param ms - Milliseconds to sleep
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
