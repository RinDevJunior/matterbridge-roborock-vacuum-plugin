export interface DpsPayload {
  id: number;
  method?: string;
  params?: any[];
  security?: {
    endpoint: string;
    nonce: string;
  };
  result: any;
}

export type Dps = Record<number | string, string | DpsPayload>;

export interface Payload {
  dps: Dps;
  t: number;
}
