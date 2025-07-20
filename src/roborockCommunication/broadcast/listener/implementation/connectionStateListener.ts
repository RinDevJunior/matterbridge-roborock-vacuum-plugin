import { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { AbstractClient } from '../../abstractClient.js';

export class ConnectionStateListener implements AbstractConnectionListener {
  protected logger: AnsiLogger;
  protected client: AbstractClient;
  constructor(logger: AnsiLogger, client: AbstractClient) {
    this.logger = logger;
    this.client = client;
  }

  public async onConnected(duid: string): Promise<void> {
    this.logger.notice(`Device ${duid} connected to MQTT broker`);
  }

  public async onDisconnected(duid: string): Promise<void> {
    this.logger.notice(`Device ${duid} disconnected from MQTT broker`);

    const isInDisconnectingStep = this.client.isInDisconnectingStep;
    if (isInDisconnectingStep) {
      this.logger.info(`Device with DUID ${duid} is in disconnecting step, skipping re-registration.`);
      return;
    }

    this.logger.info(`Re-registering device with DUID ${duid} to MQTT broker`);
    this.client.connect();

    this.client.isInDisconnectingStep = false;
  }

  public async onError(duid: string, message: string): Promise<void> {
    this.logger.error(`Error on device with DUID ${duid}: ${message}`);
  }
}
