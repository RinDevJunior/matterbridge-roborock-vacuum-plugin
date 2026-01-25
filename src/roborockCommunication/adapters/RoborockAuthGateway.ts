import { AnsiLogger } from 'matterbridge/logger';
import type { IAuthGateway } from '../../core/ports/IAuthGateway.js';
import { RoborockAuthenticateApi } from '../api/authClient.js';
import { UserData } from '../models/index.js';

/**
 * Roborock implementation of IAuthGateway.
 * Adapts the RoborockAuthenticateApi to the domain port interface.
 */
export class RoborockAuthGateway implements IAuthGateway {
  private readonly authApi: RoborockAuthenticateApi;
  private readonly logger: AnsiLogger;

  public constructor(authApi: RoborockAuthenticateApi, logger: AnsiLogger) {
    this.authApi = authApi;
    this.logger = logger;
  }

  /**
   * Request a verification code for email-based authentication.
   */
  public async requestVerificationCode(email: string): Promise<void> {
    this.logger.info(`Requesting verification code for ${email}`);
    await this.authApi.requestCodeV4(email);
    this.logger.info('Verification code sent successfully');
  }

  /**
   * Authenticate a user with email and verification code.
   */
  public async authenticate2FA(email: string, code: string): Promise<UserData> {
    this.logger.info(`2FA Authenticating user ${email}`);
    const userData = await this.authApi.loginWithCodeV4(email, code);
    this.logger.info('2FA Authentication successful');
    return userData;
  }

  public async authenticatePassword(email: string, password: string): Promise<UserData> {
    this.logger.info(`Password Authenticating user ${email}`);
    const userData = await this.authApi.loginWithPassword(email, password);
    this.logger.info('Password authentication successful');
    return userData;
  }

  /**
   * Refresh authentication token.
   */
  public async refreshToken(userData: UserData): Promise<UserData> {
    this.logger.info('Refreshing authentication token');
    // Use the existing token to re-login
    const refreshedData = await this.authApi.loginWithUserData(userData.username, userData);
    this.logger.info('Token refreshed successfully');
    return refreshedData;
  }
}
