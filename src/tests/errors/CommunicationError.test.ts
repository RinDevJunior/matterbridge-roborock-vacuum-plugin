import { describe, it, expect } from 'vitest';
import {
  CommunicationError,
  TimeoutError,
  NetworkError,
  ProtocolError,
  MQTTConnectionError,
  LocalNetworkError,
  APIError,
  SerializationError,
  DeserializationError,
} from '../../errors/CommunicationError.js';

describe('CommunicationError', () => {
  describe('CommunicationError', () => {
    it('should create error with message and metadata', () => {
      const error = new CommunicationError('Test error', { key: 'value' });

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('COMM_ERROR');
      expect(error.statusCode).toBe(503);
      expect(error.metadata).toEqual({ key: 'value' });
    });

    it('should create error without metadata', () => {
      const error = new CommunicationError('Test error');

      expect(error.message).toBe('Test error');
      expect(error.metadata).toBeUndefined();
    });
  });

  describe('TimeoutError', () => {
    it('should create timeout error with operation and timeout details', () => {
      const error = new TimeoutError('fetchData', 5000);

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Operation timed out after 5000ms: fetchData');
      expect(error.metadata).toEqual({
        reason: 'TIMEOUT',
        operation: 'fetchData',
        timeoutMs: 5000,
      });
    });

    it('should format message correctly for different operations', () => {
      const error = new TimeoutError('connectToDevice', 10000);

      expect(error.message).toBe('Operation timed out after 10000ms: connectToDevice');
      expect(error.metadata?.operation).toBe('connectToDevice');
      expect(error.metadata?.timeoutMs).toBe(10000);
    });
  });

  describe('NetworkError', () => {
    it('should create network error with message', () => {
      const error = new NetworkError('Connection refused');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Network error: Connection refused');
      expect(error.metadata).toEqual({
        reason: 'NETWORK_ERROR',
      });
    });

    it('should include additional details in metadata', () => {
      const error = new NetworkError('Connection reset', { host: 'example.com', port: 443 });

      expect(error.message).toBe('Network error: Connection reset');
      expect(error.metadata).toEqual({
        reason: 'NETWORK_ERROR',
        host: 'example.com',
        port: 443,
      });
    });
  });

  describe('ProtocolError', () => {
    it('should create protocol error with message', () => {
      const error = new ProtocolError('Invalid header');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Protocol error: Invalid header');
      expect(error.metadata).toEqual({
        reason: 'PROTOCOL_ERROR',
        protocol: undefined,
      });
    });

    it('should include protocol version in metadata', () => {
      const error = new ProtocolError('Unsupported version', 'MQTT 5.0');

      expect(error.message).toBe('Protocol error: Unsupported version');
      expect(error.metadata?.protocol).toBe('MQTT 5.0');
    });

    it('should include additional details', () => {
      const error = new ProtocolError('Parse failed', 'HTTP/1.1', { statusCode: 400, body: 'Bad Request' });

      expect(error.metadata).toEqual({
        reason: 'PROTOCOL_ERROR',
        protocol: 'HTTP/1.1',
        statusCode: 400,
        body: 'Bad Request',
      });
    });
  });

  describe('MQTTConnectionError', () => {
    it('should create MQTT connection error', () => {
      const error = new MQTTConnectionError('Authentication failed');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('MQTT connection failed: Authentication failed');
      expect(error.metadata).toEqual({
        reason: 'MQTT_CONNECTION_FAILED',
        mqttReason: 'Authentication failed',
      });
    });

    it('should handle different failure reasons', () => {
      const error = new MQTTConnectionError('Broker unavailable');

      expect(error.message).toBe('MQTT connection failed: Broker unavailable');
      expect(error.metadata?.mqttReason).toBe('Broker unavailable');
    });
  });

  describe('LocalNetworkError', () => {
    it('should create local network error with IP and port', () => {
      const error = new LocalNetworkError('192.168.1.100', 6665, 'Connection timeout');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Local network connection failed: 192.168.1.100:6665. Connection timeout');
      expect(error.metadata).toEqual({
        reason: 'LOCAL_NETWORK_FAILED',
        ip: '192.168.1.100',
        port: 6665,
        localReason: 'Connection timeout',
      });
    });

    it('should format message with different IPs and ports', () => {
      const error = new LocalNetworkError('10.0.0.5', 8080, 'Host unreachable');

      expect(error.message).toBe('Local network connection failed: 10.0.0.5:8080. Host unreachable');
      expect(error.metadata?.ip).toBe('10.0.0.5');
      expect(error.metadata?.port).toBe(8080);
    });
  });

  describe('APIError', () => {
    it('should create API error with URL', () => {
      const error = new APIError('https://api.example.com/data');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('API request failed: https://api.example.com/data');
      expect(error.metadata).toEqual({
        reason: 'API_REQUEST_FAILED',
        url: 'https://api.example.com/data',
        statusCode: undefined,
        responseBody: undefined,
      });
    });

    it('should include status code and response body', () => {
      const responseBody = { error: 'Not Found', message: 'Resource does not exist' };
      const error = new APIError('https://api.example.com/users/123', 404, responseBody);

      expect(error.message).toBe('API request failed: https://api.example.com/users/123');
      expect(error.metadata).toEqual({
        reason: 'API_REQUEST_FAILED',
        url: 'https://api.example.com/users/123',
        statusCode: 404,
        responseBody,
      });
    });

    it('should handle server errors', () => {
      const error = new APIError('/api/v1/home', 500, 'Internal Server Error');

      expect(error.metadata?.statusCode).toBe(500);
      expect(error.metadata?.responseBody).toBe('Internal Server Error');
    });
  });

  describe('SerializationError', () => {
    it('should create serialization error', () => {
      const error = new SerializationError('Cannot serialize circular reference');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Serialization failed: Cannot serialize circular reference');
      expect(error.metadata).toEqual({
        reason: 'SERIALIZATION_FAILED',
        data: undefined,
      });
    });

    it('should include data in metadata', () => {
      const data = { name: 'test', value: 123 };
      const error = new SerializationError('Invalid JSON structure', data);

      expect(error.message).toBe('Serialization failed: Invalid JSON structure');
      expect(error.metadata).toEqual({
        reason: 'SERIALIZATION_FAILED',
        data,
      });
    });
  });

  describe('DeserializationError', () => {
    it('should create deserialization error', () => {
      const error = new DeserializationError('Unexpected token in JSON');

      expect(error).toBeInstanceOf(CommunicationError);
      expect(error.message).toBe('Deserialization failed: Unexpected token in JSON');
      expect(error.metadata).toEqual({
        reason: 'DESERIALIZATION_FAILED',
        rawData: undefined,
      });
    });

    it('should include raw data in metadata', () => {
      const rawData = Buffer.from([0x00, 0x01, 0x02]);
      const error = new DeserializationError('Invalid buffer format', rawData);

      expect(error.message).toBe('Deserialization failed: Invalid buffer format');
      expect(error.metadata).toEqual({
        reason: 'DESERIALIZATION_FAILED',
        rawData,
      });
    });
  });

  describe('error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [
        new TimeoutError('op', 1000),
        new NetworkError('msg'),
        new ProtocolError('msg'),
        new MQTTConnectionError('reason'),
        new LocalNetworkError('127.0.0.1', 80, 'reason'),
        new APIError('url'),
        new SerializationError('msg'),
        new DeserializationError('msg'),
      ];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(CommunicationError);
      });
    });
  });
});
