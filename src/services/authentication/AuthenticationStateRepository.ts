import type NodePersist from 'node-persist';
import type { AuthenticateFlowState } from '../../roborockCommunication/models/index.js';

/** Repository for persisting and retrieving authentication flow state. */
export class AuthenticationStateRepository {
  constructor(private readonly persist: NodePersist.LocalStorage) {}

  /** Get current authentication flow state. */
  public async getAuthState(): Promise<AuthenticateFlowState | undefined> {
    return (await this.persist.getItem('authenticateFlowState')) as AuthenticateFlowState | undefined;
  }

  /** Save authentication flow state. */
  public async saveAuthState(state: AuthenticateFlowState): Promise<void> {
    await this.persist.setItem('authenticateFlowState', state);
  }

  /** Clear authentication flow state. */
  public async clearAuthState(): Promise<void> {
    await this.persist.removeItem('authenticateFlowState');
  }
}
