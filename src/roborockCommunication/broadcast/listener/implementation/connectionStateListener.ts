import { AnsiLogger } from 'matterbridge/logger';
import { AbstractClient, AbstractConnectionListener } from '../../index.js';
import { MANUAL_RECONNECT_DELAY_MS, MAX_RETRY_COUNT } from '@/constants/index.js';

export class ConnectionStateListener implements AbstractConnectionListener {
  protected logger: AnsiLogger;
  protected client: AbstractClient;
  protected clientName: string;
  protected shouldReconnect = false;
  private manualReconnectTimer: NodeJS.Timeout | undefined = undefined;

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
    this.logger.info(`Device ${duid} connected to ${this.clientName}`);
    this.client.retryCount = 0;
  }

  public async onReconnect(duid: string, message: string): Promise<void> {
    this.logger.info(`Device ${duid} reconnected to ${this.clientName} with message: ${message}`);
    this.client.retryCount = 0;
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

    // Clear any previous manual reconnect timer
    if (this.manualReconnectTimer) {
      clearTimeout(this.manualReconnectTimer);
      this.manualReconnectTimer = undefined;
    }

    // Wait MANUAL_RECONNECT_DELAY_MS for MQTT library to auto-reconnect. If still not connected, trigger manual reconnect.
    this.manualReconnectTimer = setTimeout(() => {
      if (typeof this.client.isConnected === 'function' && this.client.isConnected()) {
        this.logger.info(`Device with DUID ${duid} already reconnected by MQTT library, skipping manual reconnect.`);
        this.client.retryCount = 0;
        return;
      }
      this.logger.info(`Manual reconnect: Re-registering device with DUID ${duid} to ${this.clientName} after ${MANUAL_RECONNECT_DELAY_MS / 1000}s.`);
      this.client.connect();
    }, MANUAL_RECONNECT_DELAY_MS);

    this.client.isInDisconnectingStep = false;
  }

  public async onError(duid: string, message: string): Promise<void> {
    this.logger.error(`Error on device with DUID ${duid}: ${message}`);
  }
}
