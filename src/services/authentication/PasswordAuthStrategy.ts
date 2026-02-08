import type { UserData } from '../../roborockCommunication/models/index.js';
import type { IAuthStrategy } from './IAuthStrategy.js';
import type { AuthContext } from './AuthContext.js';
import { BaseAuthStrategy } from './BaseAuthStrategy.js';

/** Password authentication strategy with token caching. */
export class PasswordAuthStrategy extends BaseAuthStrategy implements IAuthStrategy {
  public async authenticate(context: AuthContext): Promise<UserData | undefined> {
    this.logger.notice('Attempting login with password...');

    const cachedUserData = await this.tryAuthenticateWithCachedToken(context.username);
    if (cachedUserData) {
      this.logger.notice('Successfully authenticated with cached token');
      return cachedUserData;
    }

    return await this.authenticateWithPassword(context);
  }

  private async authenticateWithPassword(context: AuthContext): Promise<UserData | undefined> {
    this.logger.debug('Authenticating with password for user:', context.username);
    const newUserData = await this.authService.loginWithPassword(context.username, context.password);

    try {
      await this.userDataRepository.saveUserData(newUserData);
    } catch (saveError) {
      this.logger.warn('Failed to save user data, but login succeeded:', saveError);
    }

    this.logger.notice(`Authentication ${newUserData ? 'successful' : 'failed'}!`);
    return newUserData;
  }
}
