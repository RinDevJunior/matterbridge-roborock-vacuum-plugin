import { ResponseBody } from '../../../../roborockCommunication/broadcast/model/responseBody.js';
import { Protocol } from '../../../../roborockCommunication/broadcast/model/protocol.js';
import { describe, it, expect } from 'vitest';

describe('ResponseBody', () => {
  it('returns undefined for missing fields and various index types', () => {
    const body = new ResponseBody({} as any);
    expect(body.get(1)).toBeUndefined();
    expect(body.get('1')).toBeUndefined();
    expect(body.get(Protocol.rpc_response)).toBeUndefined();
  });

  it('returns values for numeric and string keys', () => {
    const data: any = { '1': 'one', status: 'ok', '102': { id: 123 } };
    const body = new ResponseBody(data);
    expect(body.get(1)).toBe('one');
    expect(body.get('status')).toBe('ok');
    expect(body.get(102 as unknown as Protocol)).toEqual({ id: 123 });
  });

  it('handles undefined data without throwing', () => {
    // @ts-ignore intentionally pass undefined
    const body = new ResponseBody(undefined);
    expect(body.get(1)).toBeUndefined();
    expect(body.get('x')).toBeUndefined();
  });
});
