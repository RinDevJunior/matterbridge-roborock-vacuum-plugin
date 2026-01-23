import * as CryptoUtils from '../helper/cryptoHelper.js';
import { Serializer } from './Serializer.js';
import crypto from 'node:crypto';

export class A01Serializer implements Serializer {
  public encode(payload: string, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    const encoder = new TextEncoder();
    const iv = CryptoUtils.md5hex(nonce.toString(16).padStart(8, '0') + '726f626f726f636b2d67a6d6da').substring(8, 24);
    const cipher = crypto.createCipheriv('aes-128-cbc', encoder.encode(localKey), iv);
    return Buffer.concat([cipher.update(payload), cipher.final()]);
  }

  public decode(payload: Buffer, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    const iv = CryptoUtils.md5hex(nonce.toString(16).padStart(8, '0') + '726f626f726f636b2d67a6d6da').substring(8, 24);
    const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}
