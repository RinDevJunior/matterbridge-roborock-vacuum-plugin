import { MessageContext } from '../../../../roborockCommunication/broadcast/model/messageContext.js';
import { describe, it, expect } from 'vitest';
import { UserData } from '../../../../roborockCommunication/index.js';

describe('MessageContext', () => {
  const userdata: any = { rriot: { k: 'secretkey' } };

  it('constructs and exposes endpoint, nonce and serializeNonce hex', () => {
    const ctx = new MessageContext(userdata);
    expect(ctx.getEndpoint()).toBeDefined();
    expect(typeof ctx.nonce).toBe('number');
    const hex = ctx.getSerializeNonceAsHex();
    expect(hex).toMatch(/^[0-9A-F]+$/);
  });

  it('registerDevice, updateNonce and getters', () => {
    const ctx = new MessageContext(userdata);
    ctx.registerDevice('d1', 'lk', '1.0', 5);
    expect(ctx.getLocalKey('d1')).toBe('lk');
    expect(ctx.getProtocolVersion('d1')).toBe('1.0');
    expect(ctx.getDeviceNonce('d1')).toBe(5);
    ctx.updateNonce('d1', 42);
    expect(ctx.getDeviceNonce('d1')).toBe(42);
    expect(ctx.getLocalKey('no')).toBeUndefined();
  });

  it('updateNonce should not throw for non-existent device', () => {
    const ctx = new MessageContext(userdata);
    expect(() => {
      ctx.updateNonce('nonexistent', 100);
    }).not.toThrow();
    expect(ctx.getDeviceNonce('nonexistent')).toBeUndefined();
  });

  it('constructor throws when userdata is missing required fields', () => {
    expect(() => new MessageContext({} as UserData)).toThrow();
    expect(() => new MessageContext({ rriot: {} } as UserData)).toThrow();
  });

  it('updateProtocolVersion handles non-existent and existing devices', () => {
    const ctx = new MessageContext(userdata);
    // should not throw for non-existent device
    expect(() => ctx.updateProtocolVersion('no', '2.0')).not.toThrow();
    expect(ctx.getProtocolVersion('no')).toBeUndefined();

    // register and then update
    ctx.registerDevice('d2', 'lk2', '1.0', 0);
    expect(ctx.getProtocolVersion('d2')).toBe('1.0');
    ctx.updateProtocolVersion('d2', '2.0');
    expect(ctx.getProtocolVersion('d2')).toBe('2.0');
  });

  it('re-registering a device replaces stored values', () => {
    const ctx = new MessageContext(userdata);
    ctx.registerDevice('d3', 'lkA', '1.0', 1);
    expect(ctx.getLocalKey('d3')).toBe('lkA');
    ctx.registerDevice('d3', 'lkB', '2.0', 2);
    expect(ctx.getLocalKey('d3')).toBe('lkB');
    expect(ctx.getProtocolVersion('d3')).toBe('2.0');
    expect(ctx.getDeviceNonce('d3')).toBe(2);
  });

  it('should return undefined for all getters on non-existent device', () => {
    const ctx = new MessageContext(userdata);
    expect(ctx.getLocalKey('missing')).toBeUndefined();
    expect(ctx.getProtocolVersion('missing')).toBeUndefined();
    expect(ctx.getDeviceNonce('missing')).toBeUndefined();
  });
});
