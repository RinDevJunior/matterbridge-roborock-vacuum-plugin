import { describe, it, expect } from 'vitest';
import { Protocol, ResponseBody } from '../../../../roborockCommunication/models/index.js';
import { asPartial } from '../../../testUtils.js';

describe('ResponseBody', () => {
  it('returns undefined for missing fields and various index types', () => {
    const body = new ResponseBody(asPartial({}));
    expect(body.get(1)).toBeUndefined();
    expect(body.get('1')).toBeUndefined();
    expect(body.get(Protocol.rpc_response)).toBeUndefined();
  });

  it('returns values for numeric and string keys', () => {
    const data = asPartial({ '1': 'one', status: 'ok', '102': JSON.stringify({ id: 123 }) });
    const body = new ResponseBody(data);
    expect(body.get(1)).toBe('one');
    expect(body.get('status')).toBe('ok');
    expect(body.get(102 as Protocol)).toBe(JSON.stringify({ id: 123 }));
  });
});
