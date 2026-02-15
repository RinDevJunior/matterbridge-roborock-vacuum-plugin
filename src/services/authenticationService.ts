import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AuthenticationError, InvalidCredentialsError, VerificationCodeExpiredError, TokenExpiredError } from '../errors/index.js';
import type { UserData } from '../roborockCommunication/models/index.js';
import { RoborockAuthGateway } from '../roborockCommunication/adapters/RoborockAuthGateway.js';

/** Core authentication service handling low-level login operations. */
export class AuthenticationService {
  constructor(
    private readonly authGateway: RoborockAuthGateway,
    private readonly logger: AnsiLogger,
  ) {}

  /** Login with email verification code. */
  public async loginWithVerificationCode(email: string, code: string): Promise<UserData> {
    try {
      this.logger.debug('Authenticating with verification code for email:', email);
      const userdata = await this.authGateway.authenticate2FA(email, code);
      this.logger.notice('Successfully authenticated with verification code');
      return userdata;
    } catch (error) {
      this.logger.error(`Failed to login with verification code: ${debugStringify({ email, error })}`);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('expired') || errorMessage.includes('invalid')) {
        throw new VerificationCodeExpiredError(email);
      }

      throw new AuthenticationError('Authentication failed. Please verify your email and code are correct.', {
        email,
        originalError: errorMessage,
      });
    }
  }

  /** Login with cached token (validates and refreshes if needed). */
  public async loginWithCachedToken(username: string, userData: UserData): Promise<UserData> {
    try {
      this.logger.debug('Authenticating with cached token for user:', username);
      userData.username = username;
      const validatedUserData = await this.authGateway.refreshToken(userData);
      this.logger.notice('[loginWithCachedToken]: Successfully authenticated with cached token');
      return validatedUserData;
    } catch (error) {
      this.logger.error('Failed to authenticate with cached token:', { username, error });

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('expired') || errorMessage.includes('token')) {
        throw new TokenExpiredError();
      }

      throw new AuthenticationError('Session expired or invalid. Please login again.', {
        username,
        originalError: errorMessage,
      });
    }
  }

  /** Login with password. */
  public async loginWithPassword(username: string, password: string): Promise<UserData> {
    try {
      this.logger.debug('Authenticating with password for user:', username);
      const newUserData = await this.authGateway.authenticatePassword(username, password);
      this.logger.notice('Successfully authenticated with password');
      return newUserData;
    } catch (error) {
      this.logger.error('Failed to login with password:', { username, error });

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('invalid') || errorMessage.includes('incorrect') || errorMessage.includes('wrong')) {
        throw new InvalidCredentialsError(username);
      }

      throw new AuthenticationError('Authentication failed. Please use verification code login.', {
        username,
        originalError: errorMessage,
      });
    }
  }
}
