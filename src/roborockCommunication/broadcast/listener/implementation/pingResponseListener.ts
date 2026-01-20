import { Protocol, ResponseMessage, AbstractMessageListener } from '../../index.js';
import { HELLO_RESPONSE_TIMEOUT_MS } from '@/constants/index.js';

export class PingResponseListener implements AbstractMessageListener {
  private readonly duid: string;

  private handler?: (data: ResponseMessage) => void;
  private timer?: NodeJS.Timeout;

  constructor(duid: string) {
    this.duid = duid;
  }

  public waitFor(): Promise<ResponseMessage> {
    return new Promise<ResponseMessage>((resolve, reject) => {
      this.handler = resolve;
      this.timer = setTimeout(() => {
        reject('no ping response for ' + this.duid + ' within ' + HELLO_RESPONSE_TIMEOUT_MS / 1000 + ' second');
      }, HELLO_RESPONSE_TIMEOUT_MS);
    });
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (message.isForProtocol(Protocol.hello_response)) {
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
