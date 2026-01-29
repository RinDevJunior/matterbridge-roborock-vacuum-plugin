import { AnsiLogger } from 'matterbridge/logger';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { UserData } from '../roborockCommunication/models/index.js';

/** Manages ClientRouter instances per user with caching and cleanup. */
export default class ClientManager {
  private readonly clients = new Map<string, ClientRouter>();
  public constructor(private readonly logger: AnsiLogger) {}

  /** Get or create ClientRouter for a user. */
  public get(userdata: UserData): ClientRouter {
    const username = userdata.username;
    if (username.trim().length === 0) {
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
