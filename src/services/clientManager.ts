import { ClientRouter } from '../roborockCommunication/broadcast/clientRouter.js';
import { UserData } from '../roborockCommunication/index.js';
import { AnsiLogger } from 'matterbridge/logger';

/** Manages ClientRouter instances per user with caching and cleanup. */
export class ClientManager {
  private readonly clients = new Map<string, ClientRouter>();
  private logger: AnsiLogger;

  public constructor(logger: AnsiLogger) {
    this.logger = logger;
  }

  /** Get or create ClientRouter for a user. */
  public get(username: string, userdata: UserData): ClientRouter {
    if (!username || username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }

    if (!this.clients.has(username)) {
      this.clients.set(username, new ClientRouter(this.logger, userdata));
    }
    const client = this.clients.get(username);
    if (!client) {
      throw new Error(`Failed to create client for user: ${username}`);
    }
    return client;
  }

  /** Disconnect and remove a user's client. */
  public destroy(username: string): void {
    const client = this.clients.get(username);
    if (client) {
      try {
        client.disconnect();
      } catch (error) {
        this.logger.error(`Error disconnecting client for ${username}:`, error);
      }
      this.clients.delete(username);
    }
  }

  /** Disconnect all clients (for shutdown). */
  public destroyAll(): void {
    for (const [username, client] of this.clients) {
      try {
        client.disconnect();
      } catch (error) {
        this.logger.error(`Error disconnecting client for ${username}:`, error);
      }
    }
    this.clients.clear();
  }
}
