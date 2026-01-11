import { MessageContext } from '../../../../roborockCommunication/broadcast/model/messageContext.js';

describe('MessageContext', () => {
  const userdata: any = { rriot: { k: 'secretkey' } };

  test('constructs and exposes endpoint, nonce and serializeNonce hex', () => {
    const ctx = new MessageContext(userdata);
    expect(ctx.getEndpoint()).toBeDefined();
    expect(typeof ctx.nonce).toBe('number');
    const hex = ctx.getSerializeNonceAsHex();
    expect(hex).toMatch(/^[0-9A-F]+$/);
  });

  test('registerDevice, updateNonce and getters', () => {
    const ctx = new MessageContext(userdata);
    ctx.registerDevice('d1', 'lk', '1.0', 5);
    expect(ctx.getLocalKey('d1')).toBe('lk');
    expect(ctx.getProtocolVersion('d1')).toBe('1.0');
    expect(ctx.getDeviceNonce('d1')).toBe(5);
    ctx.updateNonce('d1', 42);
    expect(ctx.getDeviceNonce('d1')).toBe(42);
    expect(ctx.getLocalKey('no')).toBeUndefined();
  });

  test('updateNonce should not throw for non-existent device', () => {
    const ctx = new MessageContext(userdata);
    expect(() => ctx.updateNonce('nonexistent', 100)).not.toThrow();
    expect(ctx.getDeviceNonce('nonexistent')).toBeUndefined();
  });

  test('should return undefined for all getters on non-existent device', () => {
    const ctx = new MessageContext(userdata);
    expect(ctx.getLocalKey('missing')).toBeUndefined();
    expect(ctx.getProtocolVersion('missing')).toBeUndefined();
    expect(ctx.getDeviceNonce('missing')).toBeUndefined();
  });
});
