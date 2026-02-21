import * as CryptoUtils from '../../helper/cryptoHelper.js';
import { AbstractSerializer } from './abstractSerializer.js';
import crypto from 'node:crypto';

export class B01Serializer implements AbstractSerializer {
  public encode(
    payload: string,
    localKey: string,
    timestamp: number,
    sequence: number,
    nonce: number,
    connectNonce?: number,
    ackNonce?: number,
  ): Buffer<ArrayBuffer> {
    const encoder = new TextEncoder();
    const iv = CryptoUtils.md5hex(nonce.toString(16).padStart(8, '0') + '5wwh9ikChRjASpMU8cxg7o1d2E').substring(9, 25);
    const cipher = crypto.createCipheriv('aes-128-cbc', encoder.encode(localKey), iv);

    return Buffer.concat([cipher.update(payload), cipher.final()]);
  }

  public decode(
    payload: Buffer,
    localKey: string,
    timestamp: number,
    sequence: number,
    nonce: number,
    connectNonce?: number,
    ackNonce?: number,
  ): Buffer<ArrayBuffer> {
    const iv = CryptoUtils.md5hex(nonce.toString(16).padStart(8, '0') + '5wwh9ikChRjASpMU8cxg7o1d2E').substring(9, 25);
    const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}
