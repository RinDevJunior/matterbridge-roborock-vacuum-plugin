interface Security {
  endpoint: string;
  nonce: string;
}

export interface DpsPayload {
  id: number;
  method?: string;
  params?: unknown[] | Record<string, unknown> | undefined;
  security?: Security;
  result: unknown;
}

export type Dps = Record<number | string, number | string | DpsPayload>;

export interface Payload {
  dps: Dps;
  t: number;
}
