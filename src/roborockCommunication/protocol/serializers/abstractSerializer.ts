export interface AbstractSerializer {
  encode(
    payload: string,
    localKey: string,
    timestamp: number,
    sequence: number,
    nonce: number,
    connectNonce?: number,
    ackNonce?: number,
  ): Buffer<ArrayBuffer>;
  decode(
    payload: Buffer,
    localKey: string,
    timestamp: number,
    sequence: number,
    nonce: number,
    connectNonce?: number,
    ackNonce?: number,
  ): Buffer<ArrayBuffer>;
}
