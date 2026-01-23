export interface AuthenticateResponse<T> {
  msg?: string;
  data?: T;
  code?: number;
}
