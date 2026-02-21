import { describe, it, expect } from 'vitest';
import { MessageContext } from '../../../../roborockCommunication/models/messageContext.js';
import { RequestMessage } from '../../../../roborockCommunication/models/requestMessage.js';
import { UnknownMessageBodyBuilder } from '../../../../roborockCommunication/protocol/builders/UnknownMessageBodyBuilder.js';
import { asPartial } from '../../../helpers/testUtils.js';
import type { UserData } from '../../../../roborockCommunication/models/index.js';

const mkUser = () =>
  asPartial<UserData>({
    rriot: { r: { a: 'https://api.example', r: 'r', m: 'm', l: 'l' }, u: 'uid', s: 's', h: 'h', k: 'k' },
  });

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
    const req = new RequestMessage({ messageId: 2, timestamp: 999, body: JSON.stringify({ foo: 'bar' }) });
    const out = b.buildPayload(req, ctx);
    const parsed = JSON.parse(out);
    expect(parsed.foo).toBe('bar');
    expect(parsed.t).toBe(999);
  });
});
