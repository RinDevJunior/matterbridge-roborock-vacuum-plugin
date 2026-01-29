import { ResponseMessage } from '../../../models/index.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class ChainedMessageListener implements AbstractMessageListener {
  private listeners: AbstractMessageListener[] = [];

  public register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  public unregister(): void {
    this.listeners = [];
  }

  public async onMessage(message: ResponseMessage): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onMessage(message);
    }
  }
}
