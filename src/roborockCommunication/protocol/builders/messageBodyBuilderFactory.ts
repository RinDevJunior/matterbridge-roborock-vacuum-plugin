import { ProtocolVersion } from '../../enums/index.js';
import { A01MessageBodyBuilder } from './A01MessageBodyBuilder.js';
import { B01MessageBodyBuilder } from './B01MessageBodyBuilder.js';
import { L01MessageBodyBuilder } from './L01MessageBodyBuilder.js';
import { AbstractMessageBodyBuilder } from './abstractMessageBodyBuilder.js';
import { UnknownMessageBodyBuilder } from './UnknownMessageBodyBuilder.js';
import { V01MessageBodyBuilder } from './V01MessageBodyBuilder.js';

export class MessageBodyBuilderFactory {
  private readonly builders: Record<string, AbstractMessageBodyBuilder>;
  private readonly unknownMessageBodyBuilder: AbstractMessageBodyBuilder;
  constructor() {
    this.builders = {
      [ProtocolVersion.A01]: new A01MessageBodyBuilder(),
      [ProtocolVersion.B01]: new B01MessageBodyBuilder(),
      [ProtocolVersion.V1]: new V01MessageBodyBuilder(),
      [ProtocolVersion.L01]: new L01MessageBodyBuilder(),
    };
    this.unknownMessageBodyBuilder = new UnknownMessageBodyBuilder();
  }

  public getMessageBodyBuilder(version: string, useUnknownMessageBodyBuilder = false): AbstractMessageBodyBuilder {
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
