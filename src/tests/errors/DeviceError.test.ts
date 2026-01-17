import { describe, it, expect } from 'vitest';
import {
  DeviceError,
  DeviceNotFoundError,
  DeviceConnectionError,
  DeviceOfflineError,
  DeviceCommandError,
  UnsupportedDeviceError,
  DeviceInitializationError,
} from '../../errors/DeviceError.js';

describe('DeviceError', () => {
  describe('DeviceError base class', () => {
    it('should create error with message and duid', () => {
      const error = new DeviceError('Test error', 'device-123');

      expect(error.message).toBe('Test error');
      expect(error.duid).toBe('device-123');
      expect(error.code).toBe('DEVICE_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.metadata).toEqual({ duid: 'device-123' });
    });

    it('should create error with metadata', () => {
      const error = new DeviceError('Test error', 'device-123', { extra: 'data' });

      expect(error.metadata).toEqual({ extra: 'data', duid: 'device-123' });
    });

    it('should create error without duid', () => {
      const error = new DeviceError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.duid).toBeUndefined();
    });
  });

  describe('DeviceNotFoundError', () => {
    it('should create device not found error', () => {
      const error = new DeviceNotFoundError('device-456');

      expect(error.message).toBe('Device not found: device-456');
      expect(error.duid).toBe('device-456');
      expect(error.metadata).toEqual({
        reason: 'NOT_FOUND',
        duid: 'device-456',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new DeviceNotFoundError('device-456');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(DeviceNotFoundError);
    });
  });

  describe('DeviceConnectionError', () => {
    it('should create connection error with reason', () => {
      const error = new DeviceConnectionError('device-789', 'Network timeout');

      expect(error.message).toBe('Failed to connect to device: device-789. Network timeout');
      expect(error.duid).toBe('device-789');
      expect(error.metadata).toEqual({
        reason: 'CONNECTION_FAILED',
        connectionReason: 'Network timeout',
        duid: 'device-789',
      });
    });

    it('should create connection error with additional details', () => {
      const error = new DeviceConnectionError('device-789', 'Timeout', { attempts: 5, lastError: 'ETIMEDOUT' });

      expect(error.metadata).toEqual({
        reason: 'CONNECTION_FAILED',
        connectionReason: 'Timeout',
        attempts: 5,
        lastError: 'ETIMEDOUT',
        duid: 'device-789',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new DeviceConnectionError('device-789', 'Test');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(DeviceConnectionError);
    });
  });

  describe('DeviceOfflineError', () => {
    it('should create offline error', () => {
      const error = new DeviceOfflineError('device-offline');

      expect(error.message).toBe('Device is offline: device-offline');
      expect(error.duid).toBe('device-offline');
      expect(error.metadata).toEqual({
        reason: 'DEVICE_OFFLINE',
        duid: 'device-offline',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new DeviceOfflineError('device-offline');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(DeviceOfflineError);
    });
  });

  describe('DeviceCommandError', () => {
    it('should create command error with command name', () => {
      const error = new DeviceCommandError('device-cmd', 'start_clean');

      expect(error.message).toBe('Command failed for device device-cmd: start_clean. ');
      expect(error.duid).toBe('device-cmd');
      expect(error.metadata).toEqual({
        reason: 'COMMAND_FAILED',
        command: 'start_clean',
        commandReason: undefined,
        duid: 'device-cmd',
      });
    });

    it('should create command error with reason', () => {
      const error = new DeviceCommandError('device-cmd', 'pause', 'Device busy');

      expect(error.message).toBe('Command failed for device device-cmd: pause. Device busy');
      expect(error.metadata).toEqual({
        reason: 'COMMAND_FAILED',
        command: 'pause',
        commandReason: 'Device busy',
        duid: 'device-cmd',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new DeviceCommandError('device-cmd', 'test');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(DeviceCommandError);
    });
  });

  describe('UnsupportedDeviceError', () => {
    it('should create unsupported device error with model', () => {
      const error = new UnsupportedDeviceError('A01.vacuum');

      expect(error.message).toBe('Device model is not supported: A01.vacuum');
      expect(error.duid).toBeUndefined();
      expect(error.metadata).toEqual({
        reason: 'UNSUPPORTED_MODEL',
        model: 'A01.vacuum',
        duid: undefined,
      });
    });

    it('should create unsupported device error with duid', () => {
      const error = new UnsupportedDeviceError('A01.vacuum', 'device-unsupported');

      expect(error.message).toBe('Device model is not supported: A01.vacuum');
      expect(error.duid).toBe('device-unsupported');
      expect(error.metadata).toEqual({
        reason: 'UNSUPPORTED_MODEL',
        model: 'A01.vacuum',
        duid: 'device-unsupported',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new UnsupportedDeviceError('unknown.model');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(UnsupportedDeviceError);
    });
  });

  describe('DeviceInitializationError', () => {
    it('should create initialization error', () => {
      const error = new DeviceInitializationError('device-init', 'Failed to load config');

      expect(error.message).toBe('Failed to initialize device: device-init. Failed to load config');
      expect(error.duid).toBe('device-init');
      expect(error.metadata).toEqual({
        reason: 'INITIALIZATION_FAILED',
        initReason: 'Failed to load config',
        duid: 'device-init',
      });
    });

    it('should be instance of DeviceError', () => {
      const error = new DeviceInitializationError('device-init', 'Test reason');

      expect(error).toBeInstanceOf(DeviceError);
      expect(error).toBeInstanceOf(DeviceInitializationError);
    });
  });

  describe('Error inheritance and type checking', () => {
    it('should maintain proper prototype chain', () => {
      const errors = [
        new DeviceNotFoundError('test'),
        new DeviceConnectionError('test', 'reason'),
        new DeviceOfflineError('test'),
        new DeviceCommandError('test', 'cmd'),
        new UnsupportedDeviceError('model'),
        new DeviceInitializationError('test', 'reason'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(DeviceError);
        expect(error.name).toBeDefined();
        expect(error.stack).toBeDefined();
      });
    });

    it('should have correct error codes', () => {
      const error1 = new DeviceNotFoundError('test');
      const error2 = new DeviceConnectionError('test', 'reason');

      expect(error1.code).toBe('DEVICE_ERROR');
      expect(error2.code).toBe('DEVICE_ERROR');
    });

    it('should have correct status codes', () => {
      const error1 = new DeviceNotFoundError('test');
      const error2 = new DeviceInitializationError('test', 'reason');

      expect(error1.statusCode).toBe(500);
      expect(error2.statusCode).toBe(500);
    });
  });
});
