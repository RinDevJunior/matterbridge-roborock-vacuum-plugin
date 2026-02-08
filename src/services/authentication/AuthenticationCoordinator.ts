import { AnsiLogger } from 'matterbridge/logger';
import type { UserData } from '../../roborockCommunication/models/index.js';
import type { IAuthStrategy } from './IAuthStrategy.js';
import type { AuthContext } from './AuthContext.js';
import { PasswordAuthStrategy } from './PasswordAuthStrategy.js';
import { TwoFactorAuthStrategy } from './TwoFactorAuthStrategy.js';

/** Coordinates authentication strategies based on the selected method. */
export class AuthenticationCoordinator {
  private readonly strategies: Map<string, IAuthStrategy>;

  constructor(
    passwordStrategy: PasswordAuthStrategy,
    twoFactorStrategy: TwoFactorAuthStrategy,
    private readonly logger: AnsiLogger,
  ) {
    this.strategies = new Map<string, IAuthStrategy>([
      ['Password', passwordStrategy],
      ['VerificationCode', twoFactorStrategy],
    ]);
  }

  /**
   * Authenticate user using the specified method.
   * @param method Authentication method ('Password' or 'VerificationCode')
   * @param context Authentication context containing credentials
   * @returns UserData if successful, undefined if further action required
   */
  public async authenticate(method: string, context: AuthContext): Promise<UserData | undefined> {
    const strategy = this.strategies.get(method);

    if (!strategy) {
      const availableMethods = Array.from(this.strategies.keys()).join(', ');
      this.logger.error(`Unknown authentication method: ${method}. Available methods: ${availableMethods}`);
      throw new Error(`Unknown authentication method: ${method}`);
    }

    return strategy.authenticate(context);
  }
}
