import { HeaderMessage } from '../../../../roborockCommunication/broadcast/model/headerMessage.js';
import { ResponseBody } from '../../../../roborockCommunication/broadcast/model/responseBody.js';
import { ResponseMessage, Protocol } from '../../../../roborockCommunication/index.js';
import { describe, it, expect } from 'vitest';

describe('ResponseMessage', () => {
  it('stores duid and dps and exposes contain/get', () => {
    const dps = { '1': 'ok', '2': { id: 5 } } as any;
    const header = new HeaderMessage('1.0', 0, 0, 0, 0);
    const msg = new ResponseMessage('duid-123', header, new ResponseBody(dps));
    expect(msg.duid).toBe('duid-123');
    expect(msg.get(1 as Protocol)).toBe('ok');
    expect(msg.get(3 as Protocol)).toBeUndefined();
    expect(msg.get(2 as Protocol)).toEqual({ id: 5 });
  });

  it('isForProtocol and isForProtocols behave correctly', () => {
    const dps = { '121': { ok: true } } as any;
    const header = new HeaderMessage('1.0', 0, 0, 0, 121);
    const msg = new ResponseMessage('duid-xyz', header, new ResponseBody(dps));

    expect(msg.isForProtocol(121 as unknown as Protocol)).toBe(true);
    expect(msg.isForProtocol(122 as unknown as Protocol)).toBe(false);
    expect(msg.isForProtocols([120 as unknown as Protocol, 121 as unknown as Protocol])).toBe(true);
    expect(msg.isForProtocols([120 as unknown as Protocol, 122 as unknown as Protocol])).toBe(false);
  });

  it('handles missing header or body without throwing', () => {
    // @ts-ignore simulate missing header
    const msgNoHeader = new ResponseMessage('duid', undefined, undefined);
    expect(msgNoHeader.isForProtocol(0 as unknown as Protocol)).toBe(false);
    expect(msgNoHeader.isForProtocols([0 as unknown as Protocol])).toBe(false);
    expect(msgNoHeader.get(1 as Protocol)).toBeUndefined();

    // message with header but no body
    const header = new HeaderMessage('1.0', 0, 0, 0, 5);
    const msgNoBody = new ResponseMessage('duid2', header, undefined);
    expect(msgNoBody.isForProtocol(5 as unknown as Protocol)).toBe(true);
    expect(msgNoBody.isForStatus(5)).toBe(false);
  });
});
