export interface AbstractConnectionListener {
  onConnected(duid: string): Promise<void>;
  onDisconnected(duid: string, message: string): Promise<void>;
  onError(duid: string, message: string): Promise<void>;
  onReconnect(duid: string, message: string): Promise<void>;
}
