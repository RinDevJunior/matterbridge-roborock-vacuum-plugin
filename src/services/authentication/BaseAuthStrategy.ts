import { AnsiLogger } from 'matterbridge/logger';
import type { UserData } from '../../roborockCommunication/models/index.js';
import { AuthenticationService } from '../authenticationService.js';
import { UserDataRepository } from './UserDataRepository.js';
import { PlatformConfigManager } from '../../platform/platformConfig.js';

/** Base class for authentication strategies with shared caching logic. */
export abstract class BaseAuthStrategy {
  constructor(
    protected readonly authService: AuthenticationService,
    protected readonly userDataRepository: UserDataRepository,
    protected readonly configManager: PlatformConfigManager,
    protected readonly logger: AnsiLogger,
  ) {}

  /** Format error message from unknown error type. */
  protected formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  /** Try to authenticate with cached token if available and not bypassed. */
  protected async tryAuthenticateWithCachedToken(username: string): Promise<UserData | undefined> {
    if (this.configManager.alwaysExecuteAuthentication) {
      this.logger.debug('Always execute authentication on startup');
      await this.userDataRepository.clearUserData();
      return undefined;
    }

    const savedUserData = await this.userDataRepository.loadUserData(username);
    if (!savedUserData) {
      this.logger.debug('No saved user data found');
      return undefined;
    }

    this.logger.debug('Found saved user data, attempting to use cached token');
    try {
      return await this.authService.loginWithCachedToken(username, savedUserData);
    } catch (error) {
      this.logger.warn(`Cached token invalid or expired: ${this.formatError(error)}`);
      await this.userDataRepository.clearUserData();
      return undefined;
    }
  }
}
