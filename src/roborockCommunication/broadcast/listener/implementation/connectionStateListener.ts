import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { AbstractClient } from '../../abstractClient.js';

export class ConnectionStateListener implements AbstractConnectionListener {
  protected logger: AnsiLogger;
  protected client: AbstractClient;
  protected clientName: string;
  protected shouldReconnect: boolean;

  constructor(logger: AnsiLogger, client: AbstractClient, clientName: string, shouldReconnect = false) {
    this.logger = logger;
    this.client = client;
    this.clientName = clientName;
    this.shouldReconnect = shouldReconnect;
  }

  public async onConnected(duid: string): Promise<void> {
    this.logger.notice(`Device ${duid} connected to ${this.clientName}`);
  }

  public async onReconnect(duid: string, message: string): Promise<void> {
    this.logger.info(`Device ${duid} reconnected to ${this.clientName} with message: ${message}`);
  }

  public async onDisconnected(duid: string, message: string): Promise<void> {
    this.logger.error(`Device ${duid} disconnected from ${this.clientName} with message: ${message}`);
    if (!this.shouldReconnect) {
      this.logger.notice(`Device ${duid} disconnected from ${this.clientName}, but re-registration is disabled.`);
      return;
    }

    if (this.client.retryCount > 10) {
      this.logger.error(`Device with DUID ${duid} has exceeded retry limit, not re-registering.`);
      return;
    }

    this.client.retryCount++;

    const isInDisconnectingStep = this.client.isInDisconnectingStep;
    if (isInDisconnectingStep) {
      this.logger.info(`Device with DUID ${duid} is in disconnecting step, skipping re-registration.`);
      return;
    }

    this.logger.info(`Re-registering device with DUID ${duid} to ${this.clientName}`);

    setTimeout(() => {
      this.client.connect();
    }, 3000);

    this.client.isInDisconnectingStep = false;
  }

  public async onError(duid: string, message: string): Promise<void> {
    this.logger.error(`Error on device with DUID ${duid}: ${message}`);
  }
}
