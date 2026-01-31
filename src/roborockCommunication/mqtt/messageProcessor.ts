import { AnsiLogger } from 'matterbridge/logger';
import { SimpleMessageListener } from '../routing/listeners/implementation/simpleMessageListener.js';
import { Client } from '../routing/client.js';
import { AbstractMessageHandler } from '../routing/handlers/abstractMessageHandler.js';

export class MessageProcessor {
  private readonly client: Client;
  private readonly messageListener: SimpleMessageListener;

  constructor(
    client: Client,
    private readonly logger: AnsiLogger,
  ) {
    this.client = client;

    this.messageListener = new SimpleMessageListener(this.logger);
    this.client.registerMessageListener(this.messageListener);
  }

  public registerHandler(handler: AbstractMessageHandler): void {
    this.messageListener.registerHandler(handler);
  }
}
