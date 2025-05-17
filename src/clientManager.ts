import { AnsiLogger } from 'node-ansi-logger';
import { ClientRouter } from './roborockCommunication/broadcast/clientRouter.js';
import UserData from './roborockCommunication/Zmodel/userData.js';

export default class ClientManager {
  private readonly clients = new Map<string, ClientRouter>();
  public get(username: string, userdata: UserData, logger: AnsiLogger): ClientRouter {
    if (!this.clients.has(username)) {
      this.clients.set(username, new ClientRouter(logger, userdata));
    }
    return <ClientRouter>this.clients.get(username);
  }

  public destroy(username: string) {
    this.clients.delete(username);
  }
}
