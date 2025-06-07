import { Protocol } from './protocol.js';
import { randomInt } from 'node:crypto';

export interface ProtocolRequest {
  messageId?: number;
  protocol?: Protocol;
  method?: string | undefined;
  params?: unknown[] | Record<string, unknown> | undefined;
  secure?: boolean;
}

export class RequestMessage {
  readonly messageId: number;
  readonly protocol: Protocol;
  readonly method: string | undefined;
  readonly params: unknown[] | Record<string, unknown> | undefined;
  readonly secure: boolean;

  constructor(args: ProtocolRequest) {
    this.messageId = args.messageId ?? randomInt(10000, 32767);
    this.protocol = args.protocol ?? Protocol.rpc_request;
    this.method = args.method;
    this.params = args.params;
    this.secure = args.secure ?? false;
  }

  toMqttRequest() {
    return this;
  }

  toLocalRequest() {
    if (this.protocol == Protocol.rpc_request) {
      return new RequestMessage({
        messageId: this.messageId,
        protocol: Protocol.general_request,
        method: this.method,
        params: this.params,
        secure: this.secure,
      });
    } else {
      return this;
    }
  }
}
