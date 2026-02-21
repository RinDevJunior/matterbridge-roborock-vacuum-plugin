import { AnsiLogger } from 'matterbridge/logger';
import { RequestMessage, ResponseMessage } from '../../models/index.js';
import { MessageContext } from '../../models/messageContext.js';
import { ProtocolVersion } from '../../enums/index.js';
import { ResponseBroadcaster } from './responseBroadcaster.js';
import { V1ResponseBroadcaster } from './v1ResponseBroadcaster.js';
import { B01ResponseBroadcaster } from './b01ResponseBroadcaster.js';
import { V1PendingResponseTracker } from '../services/v1PendingResponseTracker.js';
import { B01PendingResponseTracker } from '../services/b01PendingResponseTracker.js';
import { PendingResponseTracker } from '../services/pendingResponseTracker.js';
import { AbstractMessageListener } from './abstractMessageListener.js';

export class ResponseBroadcasterFactory implements ResponseBroadcaster, PendingResponseTracker {
  readonly name = 'ResponseBroadcasterFactory';

  private readonly v1Broadcaster: V1ResponseBroadcaster;
  private readonly b01Broadcaster: B01ResponseBroadcaster;
  private readonly v1Tracker: V1PendingResponseTracker;
  private readonly b01Tracker: B01PendingResponseTracker;

  constructor(
    private readonly context: MessageContext,
    logger: AnsiLogger,
  ) {
    this.v1Tracker = new V1PendingResponseTracker(logger);
    this.b01Tracker = new B01PendingResponseTracker(logger);
    this.v1Broadcaster = new V1ResponseBroadcaster(this.v1Tracker, logger);
    this.b01Broadcaster = new B01ResponseBroadcaster(this.b01Tracker, logger);
  }

  public register(listener: AbstractMessageListener): void {
    this.v1Broadcaster.register(listener);
    this.b01Broadcaster.register(listener);
  }

  public unregister(): void {
    this.v1Broadcaster.unregister();
    this.b01Broadcaster.unregister();
  }

  public tryResolve(response: ResponseMessage): void {
    const broadcaster = this.getBroadcasterForResponse(response);
    broadcaster.tryResolve(response);
  }

  public onMessage(message: ResponseMessage): void {
    const broadcaster = this.getBroadcasterForResponse(message);
    broadcaster.onMessage(message);
  }

  public waitFor(request: RequestMessage, duid: string): Promise<ResponseMessage> {
    const tracker = this.getTrackerForDevice(duid, request);
    return tracker.waitFor(request, duid);
  }

  public cancelAll(): void {
    this.v1Tracker.cancelAll();
    this.b01Tracker.cancelAll();
  }

  private getBroadcasterForResponse(response: ResponseMessage): ResponseBroadcaster {
    const pv = response.header.version ?? this.context.getMQTTProtocolVersion(response.duid);
    if (pv === ProtocolVersion.B01) {
      return this.b01Broadcaster;
    }
    return this.v1Broadcaster;
  }

  private getTrackerForDevice(duid: string, request: RequestMessage): PendingResponseTracker {
    const pv = request.version ?? this.context.getMQTTProtocolVersion(duid);
    if (pv === ProtocolVersion.B01) {
      return this.b01Tracker;
    }
    return this.v1Tracker;
  }
}
