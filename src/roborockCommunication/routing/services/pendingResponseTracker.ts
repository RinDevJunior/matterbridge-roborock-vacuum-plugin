import { RequestMessage, ResponseMessage } from '../../models/index.js';

export interface PendingResponseTracker {
  waitFor(request: RequestMessage, duid: string): Promise<ResponseMessage>;
  tryResolve(response: ResponseMessage): void;
  cancelAll(): void;
}
