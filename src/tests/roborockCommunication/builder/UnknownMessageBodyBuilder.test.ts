import { UnknownMessageBodyBuilder } from '../../../roborockCommunication/builder/UnknownMessageBodyBuilder';
import { RequestMessage } from '../../../roborockCommunication/broadcast/model/requestMessage';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';

const mkUser = () => ({ rriot: { k: 'test-key' } }) as any;

describe('UnknownMessageBodyBuilder', () => {
  it('throws when body is missing', () => {
    const b = new UnknownMessageBodyBuilder();
    const ctx = new MessageContext(mkUser());
    const req = new RequestMessage({ messageId: 1, timestamp: 1 });
    expect(() => b.buildPayload(req, ctx)).toThrow(/Cannot build payload/);
  });

  it('parses body and sets timestamp', () => {
    const b = new UnknownMessageBodyBuilder();
    const ctx = new MessageContext(mkUser());
    const req = new RequestMessage({ messageId: 2, timestamp: 999 });
    req.body = JSON.stringify({ foo: 'bar' });
    const out = b.buildPayload(req, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.foo).toBe('bar');
    expect(parsed.t).toBe(999);
  });
});
