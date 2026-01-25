export interface ContentMessage {
  payloadLen?: number;
  payload: Buffer;
  crc32: number;
}
