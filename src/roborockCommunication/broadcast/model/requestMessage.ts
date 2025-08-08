import { Protocol } from './protocol.js';
import { randomInt } from 'node:crypto';

export interface ProtocolRequest {
  messageId?: number;
  protocol?: Protocol;
  method?: string | undefined;
  params?: unknown[] | Record<string, unknown> | undefined;
  secure?: boolean;
  nonce?: number;
  timestamp?: number;
}

export class RequestMessage {
  public readonly messageId: number;
  public readonly protocol: Protocol;
  public readonly method: string | undefined;
  public readonly params: unknown[] | Record<string, unknown> | undefined;
  public readonly secure: boolean;
  public readonly timestamp: number;
  public readonly nonce: number;

  constructor(args: ProtocolRequest) {
    this.messageId = args.messageId ?? randomInt(10000, 32767);
    this.protocol = args.protocol ?? Protocol.rpc_request;
    this.method = args.method;
    this.params = args.params;
    this.secure = args.secure ?? false;
    this.nonce = args.nonce ?? randomInt(10000, 32767);
    this.timestamp = args.timestamp ?? Math.floor(Date.now() / 1000);
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
        timestamp: this.timestamp,
      });
    } else {
      return this;
    }
  }
}
