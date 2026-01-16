import { A01Serializer } from '../serializer/A01Serializer.js';
import { B01Serializer } from '../serializer/B01Serializer.js';
import { L01Serializer } from '../serializer/L01Serializer.js';
import { Serializer } from '../serializer/Serializer.js';
import { V01Serializer } from '../serializer/V01Serializer.js';
import { ProtocolVersion } from '../Zenum/protocolVersion.js';

export class MessageProcessorFactory {
  private readonly serializer: Record<string, Serializer>;
  constructor() {
    this.serializer = {
      [ProtocolVersion.V1]: new V01Serializer(),
      [ProtocolVersion.A01]: new A01Serializer(),
      [ProtocolVersion.B01]: new B01Serializer(),
      [ProtocolVersion.L01]: new L01Serializer(),
    };
  }

  public getMessageProcessor(version: string): Serializer {
    const serializer = this.serializer[version];
    if (!serializer) {
      throw new Error('No serializer found for protocol version ' + version);
    }
    return serializer;
  }
}
