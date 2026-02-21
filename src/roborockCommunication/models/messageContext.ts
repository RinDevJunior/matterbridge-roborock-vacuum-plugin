import { randomBytes, randomInt } from 'node:crypto';
import * as CryptoUtils from '../helper/cryptoHelper.js';
import { UserData } from '../models/userData.js';

interface DeviceInfo {
  localKey: string;
  localProtocolVersion: string;
  mqttProtocolVersion: string;
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

  public registerDevice(duid: string, localKey: string, pv: string, nonce: number | undefined): void {
    this.devices.set(duid, { localKey: localKey, localProtocolVersion: pv, mqttProtocolVersion: pv, nonce });
  }

  public unregisterAllDevices(): void {
    this.devices.clear();
  }

  public updateNonce(duid: string, nonce: number): void {
    const device = this.devices.get(duid);
    if (device) {
      device.nonce = nonce;
    }
  }

  public updateLocalProtocolVersion(duid: string, pv: string): void {
    const device = this.devices.get(duid);
    if (device) {
      device.localProtocolVersion = pv;
    }
  }

  public updateMQTTProtocolVersion(duid: string, pv: string): void {
    const device = this.devices.get(duid);
    if (device) {
      device.mqttProtocolVersion = pv;
    }
  }

  public getSerializeNonceAsHex(): string {
    return this.serializeNonce.toString('hex').toUpperCase();
  }

  public getLocalKey(duid: string): string | undefined {
    return this.devices.get(duid)?.localKey;
  }

  public getLocalProtocolVersion(duid: string): string | undefined {
    return this.devices.get(duid)?.localProtocolVersion;
  }

  public getMQTTProtocolVersion(duid: string): string | undefined {
    return this.devices.get(duid)?.mqttProtocolVersion;
  }

  public getDeviceNonce(duid: string): number | undefined {
    return this.devices.get(duid)?.nonce;
  }

  public getEndpoint(): string {
    return this.endpoint;
  }
}
