export interface DpsPayload {
  id: number;
  method?: string;
  params?: unknown[] | Record<string, unknown> | undefined;
  security?: {
    endpoint: string;
    nonce: string;
  };
  result: unknown;
}

export type Dps = Record<number | string, string | DpsPayload>;

export interface Payload {
  dps: Dps;
  t: number;
}
