import crypto from 'node:crypto';
import * as CryptoUtils from '../../helper/cryptoHelper.js';
import { Serializer } from './Serializer.js';

export class V01Serializer implements Serializer {
  public encode(payload: string, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    const aesKey = CryptoUtils.md5bin(CryptoUtils.encodeTimestamp(timestamp) + localKey + CryptoUtils.SALT);
    const cipher = crypto.createCipheriv('aes-128-ecb', aesKey, null);
    return Buffer.concat([cipher.update(payload), cipher.final()]);
  }

  public decode(payload: Buffer, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    const aesKey = CryptoUtils.md5bin(CryptoUtils.encodeTimestamp(timestamp) + localKey + CryptoUtils.SALT);
    const decipher = crypto.createDecipheriv('aes-128-ecb', aesKey, null);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}
