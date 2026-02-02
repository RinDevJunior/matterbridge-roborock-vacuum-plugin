import { AnsiLogger } from 'matterbridge/logger';
import { ResponseMessage } from '../../../models/index.js';
import { PendingResponseTracker } from '../../services/pendingResponseTracker.js';
import { AbstractMessageListener } from '../abstractMessageListener.js';

export class ChainedMessageListener implements AbstractMessageListener {
  readonly name = 'ChainedMessageListener';

  private listeners: AbstractMessageListener[] = [];

  constructor(
    private readonly tracker: PendingResponseTracker,
    private readonly logger: AnsiLogger,
  ) {}

  public register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  public unregister(): void {
    this.tracker.cancelAll();
    this.listeners = [];
  }

  public onResponse(response: ResponseMessage): void {
    this.tracker.tryResolve(response);
  }

  public onMessage(message: ResponseMessage): void {
    this.logger.debug(`[ChainedMessageListener] Dispatching message to ${this.listeners.length} listeners.`);
    for (const listener of this.listeners) {
      try {
        this.logger.debug(`[ChainedMessageListener] Invoking listener: ${listener.name}`);
        listener.onMessage(message);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[ChainedMessageListener] Error in listener: ${errMsg}`);
      }
    }
  }
}
