import { randomBytes, randomInt } from 'node:crypto';
import * as CryptoUtils from '../../helper/index.js';
import { UserData } from '../../Zmodel/index.js';

interface DeviceInfo {
  localKey: string;
  protocolVersion: string;
  nonce: number | undefined;
}

export class MessageContext {
  private readonly endpoint: string;
  private readonly devices = new Map<string, DeviceInfo>();
  public readonly nonce: number;
  public readonly serializeNonce: Buffer;

  constructor(userdata: UserData) {
    this.endpoint = CryptoUtils.md5bin(userdata.rriot.k).subarray(8, 14).toString('base64');
    this.nonce = randomInt(1000, 1000000);
    this.serializeNonce = randomBytes(16);
  }

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined) {
    this.devices.set(duid, { localKey: localKey, protocolVersion: pv, nonce });
  }

  public updateNonce(duid: string, nonce: number): void {
    const device = this.devices.get(duid);
    if (device) {
      device.nonce = nonce;
    }
  }

  public updateProtocolVersion(duid: string, pv: string): void {
    const device = this.devices.get(duid);
    if (device) {
      device.protocolVersion = pv;
    }
  }

  public getSerializeNonceAsHex(): string {
    return this.serializeNonce.toString('hex').toUpperCase();
  }

  public getLocalKey(duid: string): string | undefined {
    return this.devices.get(duid)?.localKey;
  }

  public getProtocolVersion(duid: string): string | undefined {
    return this.devices.get(duid)?.protocolVersion;
  }

  public getDeviceNonce(duid: string): number | undefined {
    return this.devices.get(duid)?.nonce;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }
}
