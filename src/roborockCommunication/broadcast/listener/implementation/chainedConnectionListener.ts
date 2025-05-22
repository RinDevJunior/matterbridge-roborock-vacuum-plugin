import { AbstractConnectionListener } from '../abstractConnectionListener.js';

export class ChainedConnectionListener implements AbstractConnectionListener {
  private listeners: AbstractConnectionListener[] = [];
  register(listener: AbstractConnectionListener): void {
    this.listeners.push(listener);
  }

  async onConnected(): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onConnected();
    }
  }

  async onDisconnected(): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onDisconnected();
    }
  }

  async onError(message: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onError(message);
    }
  }
}
