import { ResponseMessage } from '../../model/responseMessage.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export default class ChainedMessageListener implements AbstractMessageListener {
  private listeners: AbstractMessageListener[] = [];

  register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  async onMessage(message: ResponseMessage): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onMessage(message);
    }
  }
}
