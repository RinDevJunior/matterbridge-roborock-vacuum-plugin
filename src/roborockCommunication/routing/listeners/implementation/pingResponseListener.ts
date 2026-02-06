import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { Protocol, ResponseMessage } from '../../../models/index.js';
import { HELLO_RESPONSE_TIMEOUT_MS } from '../../../../constants/index.js';

export class PingResponseListener implements AbstractMessageListener {
  readonly name = 'PingResponseListener';

  private handler?: (data: ResponseMessage) => void;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly duid: string,
    private logger: AnsiLogger,
  ) {}

  public waitFor(): Promise<ResponseMessage> {
    return new Promise<ResponseMessage>((resolve, reject) => {
      this.handler = resolve;
      this.timer = setTimeout(() => {
        reject(new Error(`no ping response for ${this.duid} within ${HELLO_RESPONSE_TIMEOUT_MS / 1000} second`));
      }, HELLO_RESPONSE_TIMEOUT_MS);
    });
  }

  public onMessage(message: ResponseMessage): void {
    if (message.duid !== this.duid) {
      return;
    }

    if (message.isForProtocol(Protocol.hello_response)) {
      this.logger.debug(`Received ping response message: ${debugStringify(message)}`);

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
