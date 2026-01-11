/**
 * Error handling module.
 *
 * Provides a hierarchical error structure for type-safe error handling throughout the plugin.
 * All errors extend from BaseError and include error codes, status codes, and metadata.
 *
 * @example
 * ```typescript
 * import { DeviceNotFoundError, AuthenticationError } from './errors';
 *
 * throw new DeviceNotFoundError('abc123');
 * throw new AuthenticationError('Invalid credentials', { username: 'user@example.com' });
 * ```
 */

// Base error
export { BaseError } from './BaseError.js';

// Authentication errors
export {
  AuthenticationError,
  VerificationCodeExpiredError,
  InvalidCredentialsError,
  InvalidVerificationCodeError,
  TokenExpiredError,
  RateLimitExceededError,
} from './AuthenticationError.js';

// Device errors
export {
  DeviceError,
  DeviceNotFoundError,
  DeviceConnectionError,
  DeviceOfflineError,
  DeviceCommandError,
  UnsupportedDeviceError,
  DeviceInitializationError,
} from './DeviceError.js';

// Communication errors
export {
  CommunicationError,
  TimeoutError,
  NetworkError,
  ProtocolError,
  MQTTConnectionError,
  LocalNetworkError,
  APIError,
  SerializationError,
  DeserializationError,
} from './CommunicationError.js';

// Configuration errors
export { ConfigurationError, MissingConfigurationError, InvalidConfigurationError, MissingCredentialsError, InvalidRegionError } from './ConfigurationError.js';

// Validation errors
export { ValidationError, InvalidParameterError, OutOfRangeError, MissingParameterError, InvalidFormatError } from './ValidationError.js';
