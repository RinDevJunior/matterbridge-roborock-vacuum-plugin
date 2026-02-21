import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AbstractMessageListener } from '../abstractMessageListener.js';
import { Protocol, ResponseMessage } from '../../../models/index.js';
import { HELLO_RESPONSE_TIMEOUT_MS } from '../../../../constants/index.js';

export class HelloResponseListener implements AbstractMessageListener {
  readonly name = 'HelloResponseListener';

  private handler?: (data: ResponseMessage) => void;
  private timer?: NodeJS.Timeout;

  constructor(
    public readonly duid: string,
    private logger: AnsiLogger,
  ) {}

  public waitFor(protocolVersion: string): Promise<ResponseMessage> {
    return new Promise<ResponseMessage>((resolve, reject) => {
      this.handler = resolve;
      this.timer = setTimeout(() => {
        reject(
          new Error(
            `[${this.name}] no hello response for ${this.duid} with protocol version ${protocolVersion} within ${HELLO_RESPONSE_TIMEOUT_MS / 1000} second`,
          ),
        );
      }, HELLO_RESPONSE_TIMEOUT_MS);
    });
  }

  public onMessage(message: ResponseMessage): void {
    if (message.duid !== this.duid) {
      return;
    }

    if (message.isForProtocol(Protocol.hello_response)) {
      this.logger.debug(`[${this.name}] Received hello response message: ${debugStringify(message)}`);

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
