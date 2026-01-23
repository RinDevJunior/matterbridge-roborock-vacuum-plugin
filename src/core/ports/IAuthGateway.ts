import { UserData } from '../../roborockCommunication/models/index.js';

/**
 * Port interface for authentication operations.
 * Defines the contract for user authentication and token management.
 */
export interface IAuthGateway {
  /**
   * Request a verification code for email-based authentication.
   * @param email The user's email address
   */
  requestVerificationCode(email: string): Promise<void>;

  /**
   * Authenticate a user with email and verification code.
   * @param email The user's email address
   * @param code The verification code
   * @returns User data including authentication tokens
   */
  authenticate2FA(email: string, code: string): Promise<UserData>;

  /** Authenticate a user with email and password.
   * @param email The user's email address
   * @param password The user's password
   * @returns User data including authentication tokens
   */
  authenticatePassword(email: string, password: string): Promise<UserData>;

  /**
   * Refresh authentication token.
   * @param userData Current user data with refresh token
   * @returns Updated user data with new tokens
   */
  refreshToken(userData: UserData): Promise<UserData>;
}
