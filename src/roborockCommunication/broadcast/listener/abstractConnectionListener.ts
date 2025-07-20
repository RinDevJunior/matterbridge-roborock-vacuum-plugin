export interface AbstractConnectionListener {
  onConnected(duid: string): Promise<void>;
  onDisconnected(duid: string): Promise<void>;
  onError(duid: string, message: string): Promise<void>;
}
