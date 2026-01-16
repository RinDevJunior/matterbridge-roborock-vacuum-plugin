import { Protocol } from './protocol.js';

export class HeaderMessage {
  public version: string;
  public seq: number;
  public nonce: number;
  public timestamp: number;
  public protocol: number;

  constructor(version: string, seq: number, nonce: number, timestamp: number, protocol: number) {
    this.version = version;
    this.seq = seq;
    this.nonce = nonce;
    this.timestamp = timestamp;
    this.protocol = protocol;
  }

  public isForProtocol(protocol: number | string | Protocol): boolean {
    return this.protocol === Number(protocol);
  }
}
