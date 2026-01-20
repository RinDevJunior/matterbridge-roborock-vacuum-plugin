export interface AbstractUDPMessageListener {
  onMessage(duid: string, ip: string): Promise<void>;
}
