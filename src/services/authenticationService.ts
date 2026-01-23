import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import type { IAuthGateway } from '../core/ports/IAuthGateway.js';
import { AuthenticationError, InvalidCredentialsError, VerificationCodeExpiredError, TokenExpiredError } from '../errors/index.js';
import { AuthenticateFlowState, UserData } from '../roborockCommunication/models/index.js';
import { VERIFICATION_CODE_RATE_LIMIT_MS } from '../constants/index.js';
import type NodePersist from 'node-persist';
import { PlatformConfigManager } from '../platform/platformConfig.js';

/** Callback to save user data. */
export type SaveUserDataCallback = (userData: UserData) => Promise<void>;

/** Callback to load saved user data. */
export type LoadUserDataCallback = () => Promise<UserData | undefined>;

/** Handles user authentication, token management, and session persistence. */
export class AuthenticationService {
  constructor(
    private readonly authGateway: IAuthGateway,
    private readonly persist: NodePersist.LocalStorage,
    private readonly logger: AnsiLogger,
    private readonly configManager: PlatformConfigManager,
  ) {}

  /** Request verification code to be sent to email. */
  async requestVerificationCode(email: string): Promise<void> {
    try {
      this.logger.debug('Requesting verification code for email:', email);
      await this.authGateway.requestVerificationCode(email);
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
      const userdata = await this.authGateway.authenticate2FA(email, code);

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
      userData.username = username;
      const validatedUserData = await this.authGateway.refreshToken(userData);
      this.logger.notice('[loginWithCachedToken]: Successfully authenticated with cached token');
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
      const userdata = await loadSavedUserData();

      if (!userdata || userdata.username !== username) {
        this.logger.debug('No saved user data found, authenticating with password for user:', username);
        const newUserData = await this.authGateway.authenticatePassword(username, password);

        // Save user data for future use
        try {
          await saveUserData(newUserData);
          this.logger.debug('User data saved successfully');
        } catch (saveError) {
          this.logger.warn('Failed to save user data, but login succeeded:', saveError);
        }

        this.logger.notice('Successfully authenticated with password');
        return newUserData;
      }

      this.logger.debug('Using saved user data for login');
      const validatedUserData = await this.authGateway.refreshToken(userdata);
      this.logger.notice('[loginWithPassword]: Successfully authenticated with cached token');
      return validatedUserData;
    } catch (error) {
      this.logger.error('Failed to login with password:', { username, error });

      // Check if error indicates invalid credentials
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

  /**
   * Orchestrates authentication flow with password and caching.
   * Attempts to use cached token first unless alwaysExecuteAuthentication is enabled.
   */
  async authenticateWithPasswordFlow(username: string, password: string): Promise<UserData> {
    this.logger.notice('Attempting login with password...');
    const alwaysExecuteAuthentication = this.configManager.alwaysExecuteAuthentication;
    const loadSavedUserData: LoadUserDataCallback = async () => {
      if (alwaysExecuteAuthentication) {
        this.logger.debug('Always execute authentication on startup');
        return undefined;
      }

      const savedUserData = (await this.persist.getItem('userData')) as UserData | undefined;
      if (savedUserData) {
        this.logger.debug('Loading saved userData:', debugStringify(savedUserData));
        return savedUserData;
      }
      return undefined;
    };

    const saveUserData: SaveUserDataCallback = async (userData: UserData) => {
      await this.persist.setItem('userData', userData);
    };

    const userData = await this.loginWithPassword(username, password, loadSavedUserData, saveUserData);
    this.logger.notice('Authentication successful!');
    return userData;
  }

  /**
   * Orchestrates 2FA authentication flow with verification code.
   * Handles cached token refresh, rate limiting, and verification code requests.
   */
  async authenticate2FAFlow(username: string, verificationCode: string | undefined): Promise<UserData | undefined> {
    // Try cached token first (unless always execute enabled)
    const skipAuthentication = !this.configManager.alwaysExecuteAuthentication;

    if (skipAuthentication) {
      const savedUserData = (await this.persist.getItem('userData')) as UserData | undefined;
      if (savedUserData && savedUserData.username === username) {
        this.logger.debug('Found saved userData, attempting to use cached token');
        try {
          const userData = await this.loginWithCachedToken(username, savedUserData);
          return userData;
        } catch (error) {
          // If token is invalid/expired, clear saved data and proceed to 2FA
          this.logger.warn(`Cached token invalid or expired: ${error instanceof Error ? error.message : String(error)}`);
          await this.persist.removeItem('userData');
        }
      }
    }

    // Request verification code if not provided
    if (!verificationCode || verificationCode.trim() === '') {
      const authState = (await this.persist.getItem('authenticateFlowState')) as AuthenticateFlowState | undefined;
      const now = Date.now();

      // Rate limiting
      if (authState?.codeRequestedAt && now - authState.codeRequestedAt < VERIFICATION_CODE_RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((VERIFICATION_CODE_RATE_LIMIT_MS - (now - authState.codeRequestedAt)) / 1000);
        this.logger.warn(`Please wait ${waitSeconds} seconds before requesting another code.`);
        this.logVerificationCodeBanner(username, true);
        return undefined;
      }

      try {
        this.logger.notice(`Requesting verification code for: ${username}`);
        await this.requestVerificationCode(username);

        await this.persist.setItem('authenticateFlowState', {
          email: username,
          codeRequestedAt: now,
        } as AuthenticateFlowState);

        this.logVerificationCodeBanner(username, false);
      } catch (error) {
        this.logger.error(`Failed to request verification code: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      return undefined;
    }

    // Authenticate with provided code
    this.logger.notice('Attempting login with verification code...');

    const userData = await this.loginWithVerificationCode(username, verificationCode.trim(), async (data: UserData) => {
      await this.persist.setItem('userData', data);
      await this.persist.removeItem('authenticateFlowState');
    });

    this.logger.notice('Authentication successful!');
    return userData;
  }

  /**
   * Display verification code banner instructions to user.
   */
  private logVerificationCodeBanner(email: string, wasPreviouslySent: boolean): void {
    this.logger.notice('============================================');
    this.logger.notice('ACTION REQUIRED: Enter verification code');
    this.logger.notice(`A verification code ${wasPreviouslySent ? 'was previously sent' : 'has been sent'} to: ${email}`);
    this.logger.notice('Enter the 6-digit code in the plugin configuration');
    this.logger.notice('under the "verificationCode" field, then restart the plugin.');
    this.logger.notice('============================================');
  }
}
