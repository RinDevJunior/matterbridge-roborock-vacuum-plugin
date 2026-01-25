export interface AuthenticateFlowState {
  email: string;
  codeRequestedAt?: number;
  country?: string;
  countryCode?: string;
}
