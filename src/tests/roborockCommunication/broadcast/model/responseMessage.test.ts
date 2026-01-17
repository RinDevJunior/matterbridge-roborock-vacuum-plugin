import { ResponseMessage } from '../../../../roborockCommunication/broadcast/model/responseMessage';
import { HeaderMessage } from '../../../../roborockCommunication/broadcast/model/headerMessage';
import { ResponseBody } from '../../../../roborockCommunication/broadcast/model/responseBody';
import { Protocol } from '../../../../roborockCommunication/broadcast/model/protocol';
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
});
