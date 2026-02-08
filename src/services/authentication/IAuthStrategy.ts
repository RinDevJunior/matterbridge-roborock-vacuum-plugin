import type { UserData } from '../../roborockCommunication/models/index.js';
import type { AuthContext } from './AuthContext.js';

/** Strategy interface for different authentication methods. */
export interface IAuthStrategy {
  /**
   * Authenticate user with the provided context.
   * @returns UserData if authentication succeeds, undefined if further action required.
   */
  authenticate(context: AuthContext): Promise<UserData | undefined>;
}
