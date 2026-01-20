import { A01MessageBodyBuilder, B01MessageBodyBuilder, L01MessageBodyBuilder, MessageBodyBuilder, UnknownMessageBodyBuilder, V01MessageBodyBuilder } from '../builder/index.js';
import { ProtocolVersion } from '../Zenum/index.js';

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
