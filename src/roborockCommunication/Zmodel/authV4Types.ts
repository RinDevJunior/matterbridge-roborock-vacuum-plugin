/**
 * Types for v4 2FA-based authentication flow
 */

/**
 * State persisted between plugin restarts during 2FA authentication flow
 */
export interface AuthFlowState {
  email: string;
  codeRequestedAt?: number;
  country?: string;
  countryCode?: string;
}

/**
 * Error codes returned by Roborock authentication API
 */
export enum RoborockAuthErrorCode {
  SUCCESS = 200,
  ACCOUNT_NOT_FOUND = 2008,
  INVALID_CODE = 2018,
  RATE_LIMITED = 9002,
}
