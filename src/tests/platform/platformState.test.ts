import { describe, it, expect, beforeEach } from 'vitest';
import { PlatformState, DeviceState, HomeData } from '../../platform/platformState.js';
import { asType } from '../helpers/testUtils.js';

describe('PlatformState', () => {
  let state: PlatformState;

  beforeEach(() => {
    state = new PlatformState();
  });

  describe('startup state', () => {
    it('should default to not completed', () => {
      expect(state.isStartupCompleted).toBe(false);
    });
    it('should set and get startup completed', () => {
      state.setStartupCompleted(true);
      expect(state.isStartupCompleted).toBe(true);
      state.setStartupCompleted(false);
      expect(state.isStartupCompleted).toBe(false);
    });
  });

  describe('device state', () => {
    it('should set and get device state', () => {
      const duid = 'abc';
      const devState: DeviceState = { foo: 1 };
      state.setDeviceState(duid, devState);
      expect(state.getDeviceState(duid)).toEqual(devState);
    });
    it('should return undefined for unknown device', () => {
      expect(state.getDeviceState('unknown')).toBeUndefined();
    });
    it('should not set device state if duid is empty', () => {
      state.setDeviceState('', { foo: 1 });
      expect(state.getDeviceState('')).toBeUndefined();
    });
    it('should update device state with patch', () => {
      const duid = 'abc';
      state.setDeviceState(duid, { foo: 1, bar: 2 });
      state.updateDeviceState(duid, { bar: 3, baz: 4 });
      expect(state.getDeviceState(duid)).toEqual({ foo: 1, bar: 3, baz: 4 });
    });
    it('should create device state if not present when updating', () => {
      const duid = 'abc';
      state.updateDeviceState(duid, { foo: 1 });
      expect(state.getDeviceState(duid)).toEqual({ foo: 1 });
    });
    it('should not update device state if duid is empty', () => {
      state.updateDeviceState('', { foo: 1 });
      expect(state.getDeviceState('')).toBeUndefined();
    });
  });

  describe('last home data', () => {
    it('should set and get last home data', () => {
      const duid = 'abc';
      const homeData: HomeData = { rooms: [1, 2] };
      state.setLastHomeData(duid, homeData);
      expect(state.getLastHomeData(duid)).toEqual(homeData);
    });
    it('should return undefined for unknown device', () => {
      expect(state.getLastHomeData('unknown')).toBeUndefined();
    });
    it('should not set last home data if duid is empty', () => {
      state.setLastHomeData('', { foo: 1 });
      expect(state.getLastHomeData('')).toBeUndefined();
    });
  });

  describe('clear and getAll', () => {
    it('should clear device state and last home data for a device', () => {
      const duid = 'abc';
      state.setDeviceState(duid, { foo: 1 });
      state.setLastHomeData(duid, { bar: 2 });
      state.clearDevice(duid);
      expect(state.getDeviceState(duid)).toBeUndefined();
      expect(state.getLastHomeData(duid)).toBeUndefined();
    });
    it('should clear all device states and home data', () => {
      state.setDeviceState('a', { foo: 1 });
      state.setDeviceState('b', { foo: 2 });
      state.setLastHomeData('a', { bar: 1 });
      state.setLastHomeData('b', { bar: 2 });
      state.clearAll();
      expect(state.getDeviceState('a')).toBeUndefined();
      expect(state.getDeviceState('b')).toBeUndefined();
      expect(state.getLastHomeData('a')).toBeUndefined();
      expect(state.getLastHomeData('b')).toBeUndefined();
    });
    it('should get all device states as a new map', () => {
      state.setDeviceState('a', { foo: 1 });
      state.setDeviceState('b', { foo: 2 });
      const all = state.getAllDeviceStates();
      expect(all).toBeInstanceOf(Map);
      expect(all.get('a')).toEqual({ foo: 1 });
      expect(all.get('b')).toEqual({ foo: 2 });
      // Should be a new map instance
      expect(all).not.toBe(state['deviceStates']);
    });
  });
});
