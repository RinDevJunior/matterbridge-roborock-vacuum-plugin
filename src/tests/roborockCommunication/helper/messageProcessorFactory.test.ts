import { describe, it, expect } from 'vitest';

import { MessageProcessorFactory } from '../../../roborockCommunication/helper/messageProcessorFactory.js';
import { ProtocolVersion } from '../../../roborockCommunication/enums/protocolVersion.js';
import { V01Serializer } from '../../../roborockCommunication/protocol/serializers/V01Serializer.js';
import { A01Serializer } from '../../../roborockCommunication/protocol/serializers/A01Serializer.js';
import { B01Serializer } from '../../../roborockCommunication/protocol/serializers/B01Serializer.js';
import { L01Serializer } from '../../../roborockCommunication/protocol/serializers/L01Serializer.js';
describe('MessageProcessorFactory', () => {
  it('returns correct serializer instances for known protocol versions', () => {
    const f = new MessageProcessorFactory();

    const v1 = f.getMessageProcessor(ProtocolVersion.V1);
    expect(v1).toBeInstanceOf(V01Serializer);

    const a01 = f.getMessageProcessor(ProtocolVersion.A01);
    expect(a01).toBeInstanceOf(A01Serializer);

    const b01 = f.getMessageProcessor(ProtocolVersion.B01);
    expect(b01).toBeInstanceOf(B01Serializer);

    const l01 = f.getMessageProcessor(ProtocolVersion.L01);
    expect(l01).toBeInstanceOf(L01Serializer);
  });

  it('throws when requesting unknown protocol version', () => {
    const f = new MessageProcessorFactory();
    expect(() => f.getMessageProcessor('UNKNOWN')).toThrow(/No serializer found/);
  });
});
