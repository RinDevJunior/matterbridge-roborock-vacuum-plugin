export interface ContentMessage {
  payloadLen?: number;
  payload: Buffer<ArrayBufferLike>;
  crc32: number;
}
