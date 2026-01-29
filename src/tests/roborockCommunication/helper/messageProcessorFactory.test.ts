import { describe, it, expect } from 'vitest';

import { ProtocolVersion } from '../../../roborockCommunication/enums/protocolVersion.js';
import { V01Serializer } from '../../../roborockCommunication/protocol/serializers/V01Serializer.js';
import { A01Serializer } from '../../../roborockCommunication/protocol/serializers/A01Serializer.js';
import { B01Serializer } from '../../../roborockCommunication/protocol/serializers/B01Serializer.js';
import { L01Serializer } from '../../../roborockCommunication/protocol/serializers/L01Serializer.js';
import { MessageSerializerFactory } from '../../../roborockCommunication/protocol/serializers/messageSerializerFactory.js';

describe('MessageProcessorFactory', () => {
  it('returns correct serializer instances for known protocol versions', () => {
    const f = new MessageSerializerFactory();

    const v1 = f.getMessageSerializer(ProtocolVersion.V1);
    expect(v1).toBeInstanceOf(V01Serializer);

    const a01 = f.getMessageSerializer(ProtocolVersion.A01);
    expect(a01).toBeInstanceOf(A01Serializer);

    const b01 = f.getMessageSerializer(ProtocolVersion.B01);
    expect(b01).toBeInstanceOf(B01Serializer);

    const l01 = f.getMessageSerializer(ProtocolVersion.L01);
    expect(l01).toBeInstanceOf(L01Serializer);
  });

  it('throws when requesting unknown protocol version', () => {
    const f = new MessageSerializerFactory();
    expect(() => f.getMessageSerializer('UNKNOWN')).toThrow(/No serializer found/);
  });
});
