import { BaseError } from './BaseError.js';

/**
 * Base class for communication-related errors.
 */
export class CommunicationError extends BaseError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'COMM_ERROR', 503, metadata);
  }
}

/**
 * Thrown when network request times out.
 */
export class TimeoutError extends CommunicationError {
  constructor(operation: string, timeoutMs: number) {
    super(`Operation timed out after ${timeoutMs}ms: ${operation}`, {
      reason: 'TIMEOUT',
      operation,
      timeoutMs,
    });
  }
}

/**
 * Thrown when network connection fails.
 */
export class NetworkError extends CommunicationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(`Network error: ${message}`, {
      reason: 'NETWORK_ERROR',
      ...details,
    });
  }
}

/**
 * Thrown when message protocol parsing fails.
 */
export class ProtocolError extends CommunicationError {
  constructor(message: string, protocol?: string, details?: Record<string, unknown>) {
    super(`Protocol error: ${message}`, {
      reason: 'PROTOCOL_ERROR',
      protocol,
      ...details,
    });
  }
}

/**
 * Thrown when MQTT connection fails.
 */
export class MQTTConnectionError extends CommunicationError {
  constructor(reason: string) {
    super(`MQTT connection failed: ${reason}`, {
      reason: 'MQTT_CONNECTION_FAILED',
      mqttReason: reason,
    });
  }
}

/**
 * Thrown when local network connection fails.
 */
export class LocalNetworkError extends CommunicationError {
  constructor(ip: string, port: number, reason: string) {
    super(`Local network connection failed: ${ip}:${port}. ${reason}`, {
      reason: 'LOCAL_NETWORK_FAILED',
      ip,
      port,
      localReason: reason,
    });
  }
}

/**
 * Thrown when API request fails.
 */
export class APIError extends CommunicationError {
  constructor(url: string, statusCode?: number, responseBody?: unknown) {
    super(`API request failed: ${url}`, {
      reason: 'API_REQUEST_FAILED',
      url,
      statusCode,
      responseBody,
    });
  }
}

/**
 * Thrown when message serialization fails.
 */
export class SerializationError extends CommunicationError {
  constructor(message: string, data?: unknown) {
    super(`Serialization failed: ${message}`, {
      reason: 'SERIALIZATION_FAILED',
      data,
    });
  }
}

/**
 * Thrown when message deserialization fails.
 */
export class DeserializationError extends CommunicationError {
  constructor(message: string, rawData?: unknown) {
    super(`Deserialization failed: ${message}`, {
      reason: 'DESERIALIZATION_FAILED',
      rawData,
    });
  }
}
