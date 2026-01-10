import { ResponseMessage } from '../../../../roborockCommunication/broadcast/model/responseMessage.js';

describe('ResponseMessage', () => {
  it('stores duid and dps and exposes contain/get', () => {
    const dps = { '1': 'ok', '2': { id: 5 } } as any;
    const msg = new ResponseMessage('duid-123', dps);
    expect(msg.duid).toBe('duid-123');
    expect(msg.contain(1)).toBe(true);
    expect(msg.contain('3')).toBe(false);
    expect(msg.get(1)).toBe('ok');
    expect(msg.get('2')).toEqual({ id: 5 });
  });
});
