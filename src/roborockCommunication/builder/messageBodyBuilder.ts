import { MessageContext, RequestMessage } from '../broadcast/model/index.js';

export interface MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string;
}
