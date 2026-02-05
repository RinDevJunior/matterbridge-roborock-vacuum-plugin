import { AnsiLogger } from 'matterbridge/logger';
import type { UserData } from '../../roborockCommunication/models/index.js';
import { AuthenticationService } from '../authenticationService.js';
import { UserDataRepository } from './UserDataRepository.js';
import { VerificationCodeService } from './VerificationCodeService.js';
import type { IAuthStrategy } from './IAuthStrategy.js';
import type { AuthContext } from './AuthContext.js';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';
import { BaseAuthStrategy } from './BaseAuthStrategy.js';

/** Two-factor authentication strategy with verification code. */
export class TwoFactorAuthStrategy extends BaseAuthStrategy implements IAuthStrategy {
  constructor(
    authService: AuthenticationService,
    userDataRepository: UserDataRepository,
    private readonly verificationCodeService: VerificationCodeService,
    configManager: PlatformConfigManager,
    logger: AnsiLogger,
  ) {
    super(authService, userDataRepository, configManager, logger);
  }

  public async authenticate(context: AuthContext): Promise<UserData | undefined> {
    const cachedUserData = await this.tryAuthenticateWithCachedToken(context.username);
    if (cachedUserData) {
      return cachedUserData;
    }

    if (!this.hasVerificationCode(context)) {
      return await this.handleVerificationCodeRequest(context.username);
    }

    return await this.authenticateWithCode(context);
  }

  private hasVerificationCode(context: AuthContext): boolean {
    return !!context.verificationCode && context.verificationCode.trim() !== '';
  }

  private async handleVerificationCodeRequest(username: string): Promise<undefined> {
    if (await this.verificationCodeService.isRateLimited()) {
      const waitSeconds = await this.verificationCodeService.getRemainingWaitTime();
      this.logger.warn(`Please wait ${waitSeconds} seconds before requesting another code.`);
      this.logVerificationCodeBanner(username, true);
      return undefined;
    }

    await this.requestVerificationCode(username);
    return undefined;
  }

  private async requestVerificationCode(username: string): Promise<void> {
    try {
      this.logger.notice(`Requesting verification code for: ${username}`);
      await this.verificationCodeService.requestVerificationCode(username);
      await this.verificationCodeService.recordCodeRequest(username);
      this.logVerificationCodeBanner(username, false);
    } catch (error) {
      this.logger.error(`Failed to request verification code: ${this.formatError(error)}`);
      throw error;
    }
  }

  private async authenticateWithCode(context: AuthContext): Promise<UserData | undefined> {
    if (!context.verificationCode) {
      throw new Error('Verification code is required for authentication.');
    }

    this.logger.notice('Attempting login with verification code...');
    const userData = await this.authService.loginWithVerificationCode(context.username, context.verificationCode.trim());

    await this.saveAuthenticationState(userData, context.username);
    this.logger.notice('Authentication successful!');
    return userData;
  }

  private async saveAuthenticationState(userData: UserData, username: string): Promise<void> {
    userData.username = username;

    try {
      await this.userDataRepository.saveUserData(userData);
    } catch (saveError) {
      this.logger.warn('Failed to save user data, but login succeeded:', saveError);
    }

    try {
      await this.verificationCodeService.clearCodeRequestState();
    } catch (clearError) {
      this.logger.warn('Failed to clear auth state, but login succeeded:', clearError);
    }
  }

  /** Display verification code banner instructions to user. */
  private logVerificationCodeBanner(email: string, wasPreviouslySent: boolean): void {
    this.logger.notice('============================================');
    this.logger.notice('ACTION REQUIRED: Enter verification code');
    this.logger.notice(`A verification code ${wasPreviouslySent ? 'was previously sent' : 'has been sent'} to: ${email}`);
    this.logger.notice('Enter the 6-digit code in the plugin configuration');
    this.logger.notice('under the "verificationCode" field, then restart the plugin.');
    this.logger.notice('============================================');
  }
}
