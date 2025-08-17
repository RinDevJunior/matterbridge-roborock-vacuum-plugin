export interface HeaderMessage {
  version: string;
  seq: number;
  nonce: number;
  timestamp: number;
  protocol: number;
}
