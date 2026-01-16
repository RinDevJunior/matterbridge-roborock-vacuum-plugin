import { MessageContext } from '../broadcast/model/messageContext.js';
import { RequestMessage } from '../broadcast/model/requestMessage.js';

export interface MessageBodyBuilder {
  buildPayload(request: RequestMessage, context: MessageContext): string;
}
