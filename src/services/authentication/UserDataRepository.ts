import type NodePersist from 'node-persist';
import type { UserData } from '../../roborockCommunication/models/index.js';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformConfigManager } from '../../platform/platformConfigManager.js';

/** Repository for persisting and retrieving user data. */
export class UserDataRepository {
  constructor(
    private readonly persist: NodePersist.LocalStorage,
    private readonly configManager: PlatformConfigManager,
    private readonly logger: AnsiLogger,
  ) {}

  /** Load saved user data for the given username. */
  public async loadUserData(username: string): Promise<UserData | undefined> {
    const savedUserData = (await this.persist.getItem('userData')) as UserData | undefined;

    if (!savedUserData) {
      this.logger.debug('No saved userData found');
      return undefined;
    }

    if (savedUserData.username === undefined || savedUserData.username === '' || savedUserData.username !== username) {
      this.logger.debug('Saved userData username does not match, ignoring saved data');
      await this.clearUserData();
      return undefined;
    }

    if (savedUserData.region.toUpperCase() !== this.configManager.region.toUpperCase()) {
      this.logger.debug('Saved userData region does not match current config, ignoring saved data');
      await this.clearUserData();
      return undefined;
    }

    this.logger.debug('Loading saved userData');
    return savedUserData;
  }

  /** Save user data for future use. */
  public async saveUserData(userData: UserData): Promise<void> {
    await this.persist.setItem('userData', userData);
    this.logger.debug('User data saved successfully');
  }

  /** Clear saved user data. */
  public async clearUserData(): Promise<void> {
    await this.persist.removeItem('userData');
  }
}
