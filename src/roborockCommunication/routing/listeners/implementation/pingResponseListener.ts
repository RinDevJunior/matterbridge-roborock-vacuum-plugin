import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { Protocol, ResponseMessage } from '../../../models/index.js';

export class PingResponseListener implements AbstractMessageListener {
  readonly name = 'PingResponseListener';

  private handler?: (data: ResponseMessage) => void;
  private timer?: NodeJS.Timeout;

  constructor(
    public readonly duid: string,
    private logger: AnsiLogger,
  ) {}

  public onMessage(message: ResponseMessage): void {
    if (message.duid !== this.duid) {
      return;
    }

    if (message.isForProtocol(Protocol.ping_response)) {
      this.logger.debug(`[${this.name}] Received ping response message: ${debugStringify(message)}`);

      if (this.handler) {
        this.handler(message);
      }

      // cleanup the timer
      if (this.timer) {
        clearTimeout(this.timer);
        this.timer.unref();
      }
    }
  }
}
