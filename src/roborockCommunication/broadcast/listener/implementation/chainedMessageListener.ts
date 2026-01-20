import { ResponseMessage, AbstractMessageListener } from '../../index.js';

export class ChainedMessageListener implements AbstractMessageListener {
  private listeners: AbstractMessageListener[] = [];

  public register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onMessage(message);
    }
  }
}
