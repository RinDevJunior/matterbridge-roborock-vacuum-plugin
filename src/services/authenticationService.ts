import { AnsiLogger } from 'matterbridge/logger';
import { RoborockAuthenticateApi, UserData } from '../roborockCommunication/index.js';
import { AuthenticationError, InvalidCredentialsError, VerificationCodeExpiredError, TokenExpiredError } from '../errors/index.js';

/** Callback to save user data. */
export type SaveUserDataCallback = (userData: UserData) => Promise<void>;

/** Callback to load saved user data. */
export type LoadUserDataCallback = () => Promise<UserData | undefined>;

/** Handles user authentication, token management, and session persistence. */
export class AuthenticationService {
  constructor(
    private readonly loginApi: RoborockAuthenticateApi,
    private readonly logger: AnsiLogger,
  ) {}

  /** Request verification code to be sent to email. */
  async requestVerificationCode(email: string): Promise<void> {
    try {
      this.logger.debug('Requesting verification code for email:', email);
      await this.loginApi.requestCodeV4(email);
      return;
    } catch (error) {
      this.logger.error('Failed to request verification code:', { email, error });
      throw new AuthenticationError('Failed to send verification code. Please check your email address and try again.', {
        email,
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** Login with email verification code. */
  async loginWithVerificationCode(email: string, code: string, saveUserData: SaveUserDataCallback): Promise<UserData> {
    try {
      this.logger.debug('Authenticating with verification code for email:', email);
      const userdata = await this.loginApi.loginWithCodeV4(email, code);

      // Save user data for future use
      try {
        await saveUserData(userdata);
        this.logger.debug('User data saved successfully');
      } catch (saveError) {
        this.logger.warn('Failed to save user data, but login succeeded:', saveError);
      }

      this.logger.notice('Successfully authenticated with verification code');
      return userdata;
    } catch (error) {
      this.logger.error('Failed to login with verification code:', { email, error });

      // Check if error indicates expired code
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
  async loginWithCachedToken(username: string, userData: UserData): Promise<UserData> {
    try {
      this.logger.debug('Authenticating with cached token for user:', username);
      const validatedUserData = await this.loginApi.loginWithUserData(username, userData);
      this.logger.notice('Successfully authenticated with cached token');
      return validatedUserData;
    } catch (error) {
      this.logger.error('Failed to authenticate with cached token:', { username, error });

      // Check if error indicates token expiration
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

  async loginWithPassword(username: string, password: string, loadSavedUserData: LoadUserDataCallback, saveUserData: SaveUserDataCallback): Promise<UserData> {
    try {
      let userdata = await loadSavedUserData();

      if (!userdata) {
        this.logger.debug('No saved user data found, logging in with password');
        userdata = await this.loginApi.loginWithPassword(username, password);

        try {
          await saveUserData(userdata);
          this.logger.debug('User data saved successfully');
        } catch (saveError) {
          this.logger.warn('Failed to save user data, but login succeeded:', saveError);
        }
      } else {
        this.logger.debug('Using saved user data for login');
        userdata = await this.loginApi.loginWithUserData(username, userdata);
      }

      this.logger.notice('Successfully authenticated with password');
      return userdata;
    } catch (error) {
      this.logger.error('Failed to login with password:', { username, error });

      // Check if error indicates invalid credentials
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('invalid') || errorMessage.includes('incorrect') || errorMessage.includes('wrong')) {
        throw new InvalidCredentialsError(username);
      }

      throw new AuthenticationError('Authentication failed. Please check your email and password.', {
        username,
        originalError: errorMessage,
      });
    }
  }
}
