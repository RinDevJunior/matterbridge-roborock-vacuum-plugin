import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { AbstractClient } from '../../abstractClient.js';

export class ConnectionStateListener implements AbstractConnectionListener {
  protected logger: AnsiLogger;
  protected client: AbstractClient;
  protected clientName: string;
  protected shouldReconnect: boolean;
  protected changeToSecureConnection: (duid: string) => void;

  constructor(logger: AnsiLogger, client: AbstractClient, clientName: string, changeToSecureConnection: (duid: string) => void, shouldReconnect = false) {
    this.logger = logger;
    this.client = client;
    this.clientName = clientName;
    this.shouldReconnect = shouldReconnect;
    this.changeToSecureConnection = changeToSecureConnection;
  }

  public async onConnected(duid: string): Promise<void> {
    this.logger.notice(`Device ${duid} connected to ${this.clientName}`);
  }

  public async onDisconnected(duid: string): Promise<void> {
    if (!this.shouldReconnect) {
      this.logger.notice(`Device ${duid} disconnected from ${this.clientName}, but re-registration is disabled.`);
      return;
    }

    if (this.client.retryCount > 10) {
      this.logger.error(`Device with DUID ${duid} has exceeded retry limit, not re-registering.`);
      this.changeToSecureConnection && this.changeToSecureConnection(duid);
      return;
    }

    this.client.retryCount++;

    const isInDisconnectingStep = this.client.isInDisconnectingStep;
    if (isInDisconnectingStep) {
      this.logger.info(`Device with DUID ${duid} is in disconnecting step, skipping re-registration.`);
      return;
    }

    this.logger.info(`Re-registering device with DUID ${duid} to ${this.clientName}`);
    this.client.connect();

    this.client.isInDisconnectingStep = false;
  }

  public async onError(duid: string, message: string): Promise<void> {
    this.logger.error(`Error on device with DUID ${duid}: ${message}`);
  }
}
