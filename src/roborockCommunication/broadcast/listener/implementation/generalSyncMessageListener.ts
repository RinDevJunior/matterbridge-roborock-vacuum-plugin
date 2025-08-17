import { Protocol } from '../../model/protocol.js';
import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class GeneralSyncMessageListener implements AbstractMessageListener {
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
        reject('no ping response received for ' + this.duid + ' within ' + 30 + 'second');
      }, 30 * 1000);
    });
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    if (message.contain(Protocol.hello_response)) {
      // trigger our waiters that we have received the response.
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
