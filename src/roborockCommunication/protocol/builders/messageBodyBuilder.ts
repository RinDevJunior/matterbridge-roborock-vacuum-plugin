import { MessageContext, RequestMessage } from '../../models/index.js';

export interface MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string;
}
