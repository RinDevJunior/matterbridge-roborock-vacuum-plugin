import crypto from 'node:crypto';
import { AbstractSerializer } from './abstractSerializer.js';
import * as CryptoUtils from '../../helper/cryptoHelper.js';

export class L01Serializer implements AbstractSerializer {
  public encode(payload: string, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    if (!connectNonce || !ackNonce) {
      throw new Error('connectNonce and ackNonce are required for L01 encryption');
    }

    const key = this.generateKey(localKey, timestamp);
    const iv = this.generateInitializationVector(timestamp, nonce, sequence);
    const aad = this.generateAAD(timestamp, nonce, sequence, connectNonce, ackNonce);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);

    const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([ciphertext, tag]);
  }

  public decode(payload: Buffer, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer> {
    const iv = CryptoUtils.md5hex(nonce.toString(16).padStart(8, '0') + '4c30316f72626f726f636b2d67656e65726963').substring(8, 24);
    const decipher = crypto.createDecipheriv('aes-128-cbc', localKey, iv);
    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }

  private generateKey(localKey: string, timestamp: number): Buffer {
    const hashInput = CryptoUtils.encodeTimestamp(timestamp) + localKey + 'TXdfu$jyZ#TZHsg4';
    return crypto.createHash('sha256').update(hashInput).digest();
  }

  private generateInitializationVector(timestamp: number, nonce: number, sequence: number): Buffer {
    const digestInput = Buffer.alloc(12);
    digestInput.writeUint32BE(sequence);
    digestInput.writeUint32BE(nonce, 4);
    digestInput.writeUint32BE(timestamp, 8);

    const digest = crypto.createHash('sha256').update(digestInput).digest();
    return digest.subarray(0, 12);
  }

  private generateAAD(timestamp: number, nonce: number, sequence: number, connectNonce: number, ackNonce: number): Buffer {
    const aad = Buffer.alloc(20);
    aad.writeUint32BE(sequence);
    aad.writeUint32BE(connectNonce, 4);
    aad.writeUint32BE(ackNonce, 8);
    aad.writeUint32BE(nonce, 12);
    aad.writeUint32BE(timestamp, 16);
    return aad;
  }
}
