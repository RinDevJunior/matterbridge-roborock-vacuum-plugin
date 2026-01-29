import { ProtocolVersion } from '../../enums/index.js';
import { A01Serializer } from './A01Serializer.js';
import { B01Serializer } from './B01Serializer.js';
import { L01Serializer } from './L01Serializer.js';
import { AbstractSerializer } from './abstractSerializer.js';
import { V01Serializer } from './V01Serializer.js';

export class MessageSerializerFactory {
  private readonly serializers: Record<string, AbstractSerializer>;
  constructor() {
    this.serializers = {
      [ProtocolVersion.V1]: new V01Serializer(),
      [ProtocolVersion.A01]: new A01Serializer(),
      [ProtocolVersion.B01]: new B01Serializer(),
      [ProtocolVersion.L01]: new L01Serializer(),
    };
  }

  public getMessageSerializer(version: string): AbstractSerializer {
    const serializer = this.serializers[version];
    if (!serializer) {
      throw new Error('No serializer found for protocol version ' + version);
    }
    return serializer;
  }
}
