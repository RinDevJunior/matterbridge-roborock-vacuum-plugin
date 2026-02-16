import { describe, it, expect } from 'vitest';
import { MessageContext, UserData } from '../../../../roborockCommunication/models/index.js';
import { asPartial, asType, mkUser } from '../../../helpers/testUtils.js';

describe('MessageContext', () => {
  it('constructs and exposes endpoint, nonce and serializeNonce hex', () => {
    const ctx = new MessageContext(mkUser());
    expect(ctx.getEndpoint()).toBeDefined();
    expect(typeof ctx.nonce).toBe('number');
    const hex = ctx.getSerializeNonceAsHex();
    expect(hex).toMatch(/^[0-9A-F]+$/);
  });

  it('registerDevice, updateNonce and getters', () => {
    const ctx = new MessageContext(mkUser());
    ctx.registerDevice('d1', 'lk', '1.0', 5);
    expect(ctx.getLocalKey('d1')).toBe('lk');
    expect(ctx.getLocalProtocolVersion('d1')).toBe('1.0');
    expect(ctx.getDeviceNonce('d1')).toBe(5);
    ctx.updateNonce('d1', 42);
    expect(ctx.getDeviceNonce('d1')).toBe(42);
    expect(ctx.getLocalKey('no')).toBeUndefined();
  });

  it('updateNonce should not throw for non-existent device', () => {
    const ctx = new MessageContext(mkUser());
    expect(() => {
      ctx.updateNonce('nonexistent', 100);
    }).not.toThrow();
    expect(ctx.getDeviceNonce('nonexistent')).toBeUndefined();
  });

  it('constructor throws when userdata is missing required fields', () => {
    expect(() => new MessageContext(asType<UserData>({}))).toThrow();
    expect(() => new MessageContext(asType<UserData>(undefined))).toThrow();
  });

  it('updateProtocolVersion handles non-existent and existing devices', () => {
    const ctx = new MessageContext(mkUser());
    // should not throw for non-existent device
    expect(() => ctx.updateLocalProtocolVersion('no', '2.0')).not.toThrow();
    expect(ctx.getLocalProtocolVersion('no')).toBeUndefined();

    // register and then update
    ctx.registerDevice('d2', 'lk2', '1.0', 0);
    expect(ctx.getLocalProtocolVersion('d2')).toBe('1.0');
    ctx.updateLocalProtocolVersion('d2', '2.0');
    expect(ctx.getLocalProtocolVersion('d2')).toBe('2.0');
  });

  it('re-registering a device replaces stored values', () => {
    const ctx = new MessageContext(mkUser());
    ctx.registerDevice('d3', 'lkA', '1.0', 1);
    expect(ctx.getLocalKey('d3')).toBe('lkA');
    ctx.registerDevice('d3', 'lkB', '2.0', 2);
    expect(ctx.getLocalKey('d3')).toBe('lkB');
    expect(ctx.getLocalProtocolVersion('d3')).toBe('2.0');
    expect(ctx.getDeviceNonce('d3')).toBe(2);
  });

  it('should return undefined for all getters on non-existent device', () => {
    const ctx = new MessageContext(mkUser());
    expect(ctx.getLocalKey('missing')).toBeUndefined();
    expect(ctx.getLocalProtocolVersion('missing')).toBeUndefined();
    expect(ctx.getDeviceNonce('missing')).toBeUndefined();
  });

  it('updateMQTTProtocolVersion should update version for existing device', () => {
    const ctx = new MessageContext(mkUser());
    ctx.registerDevice('d1', 'lk', '1.0', 5);
    expect(ctx.getMQTTProtocolVersion('d1')).toBe('1.0');
    ctx.updateMQTTProtocolVersion('d1', '3.0');
    expect(ctx.getMQTTProtocolVersion('d1')).toBe('3.0');
  });

  it('updateMQTTProtocolVersion should not throw for non-existent device', () => {
    const ctx = new MessageContext(mkUser());
    expect(() => ctx.updateMQTTProtocolVersion('nonexistent', '2.0')).not.toThrow();
    expect(ctx.getMQTTProtocolVersion('nonexistent')).toBeUndefined();
  });

  it('getMQTTProtocolVersion should return undefined for non-existent device', () => {
    const ctx = new MessageContext(mkUser());
    expect(ctx.getMQTTProtocolVersion('missing')).toBeUndefined();
  });

  it('unregisterAllDevices should clear all registered devices', () => {
    const ctx = new MessageContext(mkUser());
    ctx.registerDevice('d1', 'lk1', '1.0', 1);
    ctx.registerDevice('d2', 'lk2', '1.0', 2);
    expect(ctx.getLocalKey('d1')).toBe('lk1');
    expect(ctx.getLocalKey('d2')).toBe('lk2');
    ctx.unregisterAllDevices();
    expect(ctx.getLocalKey('d1')).toBeUndefined();
    expect(ctx.getLocalKey('d2')).toBeUndefined();
  });
});
