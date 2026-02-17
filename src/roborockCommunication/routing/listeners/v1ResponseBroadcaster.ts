import { AnsiLogger } from 'matterbridge/logger';
import { ResponseMessage } from '../../models/index.js';
import { V1PendingResponseTracker } from '../services/v1PendingResponseTracker.js';
import { AbstractMessageListener } from './abstractMessageListener.js';
import { ResponseBroadcaster } from './responseBroadcaster.js';

export class V1ResponseBroadcaster implements ResponseBroadcaster {
  readonly name = 'ResponseBroadcaster';

  private listeners: AbstractMessageListener[] = [];

  constructor(
    private readonly tracker: V1PendingResponseTracker,
    private readonly logger: AnsiLogger,
  ) {}

  public register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  public unregister(): void {
    this.tracker.cancelAll();
    this.listeners = [];
  }

  public tryResolve(response: ResponseMessage): void {
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
