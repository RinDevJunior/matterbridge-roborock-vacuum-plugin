export interface AbstractConnectionListener {
  onConnected(): Promise<void>;
  onDisconnected(): Promise<void>;
  onError(message: string): Promise<void>;
}
