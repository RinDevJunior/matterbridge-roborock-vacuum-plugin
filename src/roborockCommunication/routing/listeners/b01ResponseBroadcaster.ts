import { AnsiLogger } from 'matterbridge/logger';
import { RequestMessage, ResponseMessage } from '../../models/index.js';
import { B01PendingResponseTracker } from '../services/b01PendingResponseTracker.js';
import { AbstractMessageListener } from './abstractMessageListener.js';
import { ResponseBroadcaster } from './responseBroadcaster.js';

export class B01ResponseBroadcaster implements ResponseBroadcaster {
  readonly name = 'B01ResponseBroadcaster';

  private listeners: AbstractMessageListener[] = [];

  constructor(
    private readonly tracker: B01PendingResponseTracker,
    private readonly logger: AnsiLogger,
  ) {}

  public register(listener: AbstractMessageListener): void {
    this.listeners.push(listener);
  }

  public unregister(): void {
    this.tracker.cancelAll();
    this.listeners = [];
  }

  public waitFor(request: RequestMessage, duid: string): Promise<ResponseMessage> {
    return this.tracker.waitFor(request, duid);
  }

  public tryResolve(response: ResponseMessage): void {
    this.tracker.tryResolve(response);
  }

  public onMessage(message: ResponseMessage): void {
    this.logger.debug(`[B01ResponseBroadcaster] Dispatching message to ${this.listeners.length} listeners.`);
    for (const listener of this.listeners) {
      try {
        this.logger.debug(`[B01ResponseBroadcaster] Invoking listener: ${listener.name}`);
        listener.onMessage(message);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        this.logger.error(`[B01ResponseBroadcaster] Error in listener: ${errMsg}`);
      }
    }
  }
}
