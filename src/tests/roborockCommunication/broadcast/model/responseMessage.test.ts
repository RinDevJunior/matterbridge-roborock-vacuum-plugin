import { describe, it, expect } from 'vitest';
import { asPartial, asType } from '../../../helpers/testUtils.js';
import {
  Dps,
  HeaderMessage,
  Protocol,
  ResponseBody,
  ResponseMessage,
} from '../../../../roborockCommunication/models/index.js';

describe('ResponseMessage', () => {
  it('stores duid and dps and exposes contain/get', () => {
    const dps = asPartial<Dps>({ 102: { id: 18755, result: [110] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 0);
    const msg = new ResponseMessage('duid-123', header, new ResponseBody(dps));
    expect(msg.duid).toBe('duid-123');
    expect(msg.get(asType<Protocol>(102))).toEqual({ id: 18755, result: [110] });
    expect(msg.get(asType<Protocol>(3))).toBeUndefined();
  });

  it('isForProtocol and isForProtocols behave correctly', () => {
    const dps = asPartial<Dps>({ 121: { id: 13874, result: ['ok'] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 121);
    const msg = new ResponseMessage('duid-xyz', header, new ResponseBody(dps));

    expect(msg.isForProtocol(asType<Protocol>(121))).toBe(true);
    expect(msg.isForProtocol(asType<Protocol>(122))).toBe(false);
    expect(msg.isForProtocols([asType<Protocol>(120), asType<Protocol>(121)])).toBe(true);
    expect(msg.isForProtocols([asType<Protocol>(120), asType<Protocol>(122)])).toBe(false);
  });

  it('handles missing header or body without throwing', () => {
    // message with header but no body
    const header = new HeaderMessage('1.0', 0, 0, 0, 5);
    const msgNoBody = new ResponseMessage('duid2', header, undefined);
    expect(msgNoBody.isForProtocol(asType<Protocol>(5))).toBe(true);
    expect(msgNoBody.isForStatus(5)).toBe(false);
  });

  it('identifies simple ok response correctly', () => {
    const dps = asPartial<Dps>({ 102: { id: 373102, result: ['ok'] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 102);
    const msg = new ResponseMessage('duid-ok', header, new ResponseBody(dps));
    expect(msg.isSimpleOkResponse()).toBe(true);
  });

  it('returns false for non-ok response', () => {
    const dps = asPartial<Dps>({ 102: { id: 18755, result: [110] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 102);
    const msg = new ResponseMessage('duid-123', header, new ResponseBody(dps));
    expect(msg.isSimpleOkResponse()).toBe(false);
  });

  it('returns false for ok response with multiple elements', () => {
    const dps = asPartial<Dps>({ 102: { id: 18755, result: ['ok', 'extra'] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 102);
    const msg = new ResponseMessage('duid-multi', header, new ResponseBody(dps));
    expect(msg.isSimpleOkResponse()).toBe(false);
  });

  it('returns false when result is not an array', () => {
    const dps = asPartial<Dps>({ 102: { id: 18755, result: 'ok' } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 102);
    const msg = new ResponseMessage('duid-str', header, new ResponseBody(dps));
    expect(msg.isSimpleOkResponse()).toBe(false);
  });

  it('returns false when rpc_response data is missing', () => {
    const dps = asPartial<Dps>({ 121: { id: 18755, result: ['ok'] } });
    const header = new HeaderMessage('1.0', 0, 0, 0, 121);
    const msg = new ResponseMessage('duid-no-rpc', header, new ResponseBody(dps));
    expect(msg.isSimpleOkResponse()).toBe(false);
  });

  it('returns false when body is undefined', () => {
    const header = new HeaderMessage('1.0', 0, 0, 0, 102);
    const msg = new ResponseMessage('duid-no-body', header, undefined);
    expect(msg.isSimpleOkResponse()).toBe(false);
  });
});
