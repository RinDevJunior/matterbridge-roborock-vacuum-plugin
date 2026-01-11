export interface Serializer {
  encode(payload: string, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer>;
  decode(payload: Buffer<ArrayBufferLike>, localKey: string, timestamp: number, sequence: number, nonce: number, connectNonce?: number, ackNonce?: number): Buffer<ArrayBuffer>;
}
