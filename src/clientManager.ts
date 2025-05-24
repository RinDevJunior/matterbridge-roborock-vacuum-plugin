import { ClientRouter } from './roborockCommunication/broadcast/clientRouter.js';
import { UserData } from './roborockCommunication/index.js';
import { AnsiLogger } from 'matterbridge/logger';

export default class ClientManager {
  private readonly clients = new Map<string, ClientRouter>();
  private logger: AnsiLogger;

  public constructor(logger: AnsiLogger) {
    this.logger = logger;
  }

  public get(username: string, userdata: UserData): ClientRouter {
    if (!this.clients.has(username)) {
      this.clients.set(username, new ClientRouter(this.logger, userdata));
    }
    return <ClientRouter>this.clients.get(username);
  }

  public destroy(username: string): void {
    this.clients.delete(username);
  }
}
