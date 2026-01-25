import { AbstractConnectionListener } from '../abstractConnectionListener.js';

export class ChainedConnectionListener implements AbstractConnectionListener {
  private listeners: AbstractConnectionListener[] = [];

  public register(listener: AbstractConnectionListener): void {
    this.listeners.push(listener);
  }

  public async onConnected(duid: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onConnected(duid);
    }
  }

  public async onDisconnected(duid: string, message: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onDisconnected(duid, message);
    }
  }

  public async onError(duid: string, message: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onError(duid, message);
    }
  }

  public async onReconnect(duid: string, message: string): Promise<void> {
    for (const listener of this.listeners) {
      await listener.onReconnect(duid, message);
    }
  }
}
