import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { AbstractClient } from '../../abstractClient.js';
import { RECONNECT_DELAY_MS, MAX_RETRY_COUNT } from '../../../../constants/index.js';

export class ConnectionStateListener implements AbstractConnectionListener {
  protected logger: AnsiLogger;
  protected client: AbstractClient;
  protected clientName: string;
  protected shouldReconnect = false;

  constructor(logger: AnsiLogger, client: AbstractClient, clientName: string) {
    this.logger = logger;
    this.client = client;
    this.clientName = clientName;
  }

  public start(): void {
    this.shouldReconnect = true;
  }

  public stop(): void {
    this.shouldReconnect = false;
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

    if (this.client.retryCount > MAX_RETRY_COUNT) {
      this.logger.error(`Device with DUID ${duid} has exceeded retry limit, not re-registering.`);
      return;
    }

    this.client.retryCount++;

    const isInDisconnectingStep = this.client.isInDisconnectingStep;
    if (isInDisconnectingStep) {
      this.logger.info(`Device with DUID ${duid} is in disconnecting step, skipping re-registration.`);
      return;
    }

    setTimeout(() => {
      this.logger.info(`Re-registering device with DUID ${duid} to ${this.clientName}`);
      this.client.connect();
    }, RECONNECT_DELAY_MS);

    this.client.isInDisconnectingStep = false;
  }

  public async onError(duid: string, message: string): Promise<void> {
    this.logger.error(`Error on device with DUID ${duid}: ${message}`);
  }
}
