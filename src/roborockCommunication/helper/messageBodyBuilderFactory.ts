import { ProtocolVersion } from '../enums/index.js';
import { A01MessageBodyBuilder } from '../protocol/builders/A01MessageBodyBuilder.js';
import { B01MessageBodyBuilder } from '../protocol/builders/B01MessageBodyBuilder.js';
import { L01MessageBodyBuilder } from '../protocol/builders/L01MessageBodyBuilder.js';
import { MessageBodyBuilder } from '../protocol/builders/messageBodyBuilder.js';
import { UnknownMessageBodyBuilder } from '../protocol/builders/UnknownMessageBodyBuilder.js';
import { V01MessageBodyBuilder } from '../protocol/builders/V01MessageBodyBuilder.js';

export class MessageBodyBuilderFactory {
  private readonly builders: Record<string, MessageBodyBuilder>;
  private readonly unknownMessageBodyBuilder: MessageBodyBuilder;
  constructor() {
    this.builders = {
      [ProtocolVersion.A01]: new A01MessageBodyBuilder(),
      [ProtocolVersion.B01]: new B01MessageBodyBuilder(),
      [ProtocolVersion.V1]: new V01MessageBodyBuilder(),
      [ProtocolVersion.L01]: new L01MessageBodyBuilder(),
    };
    this.unknownMessageBodyBuilder = new UnknownMessageBodyBuilder();
  }

  public getMessageBodyBuilder(version: string, useUnknownMessageBodyBuilder = false): MessageBodyBuilder {
    if (useUnknownMessageBodyBuilder) {
      return this.unknownMessageBodyBuilder;
    }
    const builder = this.builders[version];
    if (!builder) {
      throw new Error('No message body builder found for protocol version ' + version);
    }
    return builder;
  }
}
