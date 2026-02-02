import { AnsiLogger } from 'matterbridge/logger';
import type { IDeviceGateway, DeviceCommand, DeviceStatus, StatusCallback } from '../../core/ports/IDeviceGateway.js';
import { ClientRouter } from '../routing/clientRouter.js';
import { DpsPayload, Protocol, RequestMessage, ResponseMessage } from '../models/index.js';
import { AbstractMessageListener } from '../routing/listeners/abstractMessageListener.js';
import { Security } from '../../types/device.js';

/**
 * Roborock implementation of IDeviceGateway.
 * Adapts the ClientRouter to the domain port interface.
 */
export class RoborockDeviceGateway implements IDeviceGateway {
  private readonly clientRouter: ClientRouter;
  private readonly logger: AnsiLogger;
  private readonly statusCallbacks = new Map<string, Set<StatusCallback>>();

  public constructor(clientRouter: ClientRouter, logger: AnsiLogger) {
    this.clientRouter = clientRouter;
    this.logger = logger;

    this.clientRouter.registerMessageListener({
      name: 'RoborockDeviceGatewayListener',
      onMessage: async (message) => {
        if (message instanceof ResponseMessage) {
          const duid = message.duid;
          if (!duid || message.isForProtocol(Protocol.battery)) return;

          if (message.isForProtocol(Protocol.hello_response)) {
            const nonce = message.get(Protocol.hello_response) as DpsPayload;
            const result = nonce.result as Security;
            this.clientRouter.updateNonce(duid, result.nonce);
            return;
          }

          this.notifyStatusCallbacks(duid, message as unknown as DeviceStatus);
        }
      },
    } as AbstractMessageListener);
  }

  /**
   * Send a command to a device.
   */
  public async sendCommand(duid: string, command: DeviceCommand): Promise<void> {
    const request = new RequestMessage({
      method: command.method,
      params: command.params,
      secure: false,
    });

    await this.clientRouter.send(duid, request);
    this.logger.debug(`Sent command ${command.method} to device ${duid}`);
  }

  /**
   * Get the current status of a device.
   */
  public async getStatus(duid: string): Promise<DeviceStatus> {
    const request = new RequestMessage({
      method: 'get_status',
      params: [],
      secure: false,
    });

    const response = await this.clientRouter.get<DeviceStatus>(duid, request);
    if (!response) {
      throw new Error(`Failed to get status for device ${duid}`);
    }

    return response;
  }

  /**
   * Subscribe to status updates from a device.
   */
  public subscribe(duid: string, callback: StatusCallback): () => void {
    if (!this.statusCallbacks.has(duid)) {
      this.statusCallbacks.set(duid, new Set());
    }

    const callbacks = this.statusCallbacks.get(duid);
    if (callbacks) {
      callbacks.add(callback);
      this.statusCallbacks.set(duid, callbacks);
    }

    // Return unsubscribe function
    return () => {
      const callbacks = this.statusCallbacks.get(duid);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.statusCallbacks.delete(duid);
        }
      }
    };
  }

  /**
   * Notify all status callbacks for a device.
   */
  private notifyStatusCallbacks(duid: string, status: DeviceStatus): void {
    const callbacks = this.statusCallbacks.get(duid);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(status);
        } catch (error) {
          this.logger.error(`Error in status callback for device ${duid}:`, error);
        }
      });
    }
  }
}
