import { MessageContext, RequestMessage } from '../../models/index.js';

export interface AbstractMessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string;
}
