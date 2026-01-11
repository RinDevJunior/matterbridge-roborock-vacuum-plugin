import { L01MessageBodyBuilder } from '../../../roborockCommunication/builder/L01MessageBodyBuilder';
import { RequestMessage } from '../../../roborockCommunication/broadcast/model/requestMessage';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';
import { Protocol } from '../../../roborockCommunication/broadcast/model/protocol';

const mkUser = () => ({ rriot: { k: 'test-key' } }) as any;

describe('L01MessageBodyBuilder', () => {
  it('builds payload and converts general_request to rpc_request', () => {
    const builder = new L01MessageBodyBuilder();
    const ctx = new MessageContext(mkUser());
    const req = new RequestMessage({ messageId: 42, protocol: Protocol.general_request, timestamp: 12345 });
    const out = builder.buildPayload(req, ctx);
    const parsed = JSON.parse(out);
    const key = Object.keys(parsed.dps)[0];
    const inner = JSON.parse(parsed.dps[key]);
    expect(inner.id).toBe(42);
    expect(Number(key)).toBe(Protocol.rpc_request);
  });

  it('includes provided params and method', () => {
    const builder = new L01MessageBodyBuilder();
    const ctx = new MessageContext(mkUser());
    const req = new RequestMessage({ messageId: 7, protocol: Protocol.rpc_request, method: 'm', params: [1, 2], timestamp: 100 });
    const out = builder.buildPayload(req, ctx);
    const parsed = JSON.parse(out);
    const key = Object.keys(parsed.dps)[0];
    const inner = JSON.parse(parsed.dps[key]);
    expect(inner.method).toBe('m');
    expect(inner.params).toEqual([1, 2]);
  });
});
