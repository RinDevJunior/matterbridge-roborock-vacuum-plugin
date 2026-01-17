import { describe, it, expect } from 'vitest';
import { MessageBodyBuilderFactory } from '../../../roborockCommunication/helper/messageBodyBuilderFactory';
import { ProtocolVersion } from '../../../roborockCommunication/Zenum/protocolVersion';
import { RequestMessage } from '../../../roborockCommunication/broadcast/model/requestMessage';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';

const mkUser = () => ({ rriot: { k: 'test-key' } }) as any;

describe('MessageBodyBuilderFactory', () => {
  it('returns known builders and throws for unknown version', () => {
    const f = new MessageBodyBuilderFactory();
    const b1 = f.getMessageBodyBuilder(ProtocolVersion.A01);
    expect(typeof b1.buildPayload).toBe('function');
    const b2 = f.getMessageBodyBuilder(ProtocolVersion.V1);
    expect(typeof b2.buildPayload).toBe('function');
    expect(() => f.getMessageBodyBuilder('ZZZ')).toThrow(/No message body builder/);
  });

  it('can return unknown builder when requested', () => {
    const f = new MessageBodyBuilderFactory();
    const ub = f.getMessageBodyBuilder('anything', true);
    const ctx = new MessageContext(mkUser());
    const req = new RequestMessage({ messageId: 1, timestamp: 10 });
    // Unknown builder requires req.body to be set; calling without body should throw
    expect(() => ub.buildPayload(req, ctx)).toThrow();
  });
});
