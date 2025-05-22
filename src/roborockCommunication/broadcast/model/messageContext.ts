import { randomBytes } from 'node:crypto';
import { CryptoUtils } from '../../helper/cryptoHelper.js';
import { UserData } from '../../Zmodel/userData.js';

export class MessageContext {
  private readonly endpoint: string;
  readonly nonce: Buffer;
  private readonly devices: Map<string, { localKey: string; protocolVersion: string }> = new Map();

  constructor(userdata: UserData) {
    this.endpoint = CryptoUtils.md5bin(userdata.rriot.k).subarray(8, 14).toString('base64');
    this.nonce = randomBytes(16);
  }

  registerDevice(duid: string, localKey: string, pv: string) {
    this.devices.set(duid, { localKey: localKey, protocolVersion: pv });
  }

  getNonceAsHex(): string {
    return this.nonce.toString('hex').toUpperCase();
  }

  getLocalKey(duid: string): string | undefined {
    return this.devices.get(duid)?.localKey;
  }

  getProtocolVersion(duid: string): string | undefined {
    return this.devices.get(duid)?.protocolVersion;
  }

  getEndpoint(): string {
    return this.endpoint;
  }
}
