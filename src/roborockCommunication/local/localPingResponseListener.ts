import { AnsiLogger } from 'matterbridge/logger';
import { AbstractMessageListener } from '../routing/listeners/abstractMessageListener.js';
import { Protocol, ResponseMessage } from '../models/index.js';

export class LocalPingResponseListener implements AbstractMessageListener {
  readonly name = 'LocalPingResponseListener';
  private timer?: NodeJS.Timeout;

  public lastPingResponse: number;

  constructor(
    public readonly duid: string,
    private logger: AnsiLogger,
  ) {
    this.lastPingResponse = Date.now();
  }

  public onMessage(message: ResponseMessage): void {
    if (message.duid !== this.duid) {
      return;
    }

    if (message.isForProtocol(Protocol.ping_response)) {
      this.logger.debug(`[${this.name}] Received ping response message for DUID ${this.duid}, the local communication is healthy.`);

      this.lastPingResponse = Date.now();

      // cleanup the timer
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer.unref();
      }
    }
  }
}
