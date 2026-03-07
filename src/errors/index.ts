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
	InvalidCredentialsError,
	InvalidVerificationCodeError,
	RateLimitExceededError,
	TokenExpiredError,
	VerificationCodeExpiredError,
} from './AuthenticationError.js';

// Device errors
export {
	DeviceCommandError,
	DeviceConnectionError,
	DeviceError,
	DeviceInitializationError,
	DeviceNotFoundError,
	DeviceOfflineError,
	UnsupportedDeviceError,
} from './DeviceError.js';

// Communication errors
export {
	APIError,
	CommunicationError,
	DeserializationError,
	LocalNetworkError,
	MQTTConnectionError,
	NetworkError,
	ProtocolError,
	SerializationError,
	TimeoutError,
} from './CommunicationError.js';

// Configuration errors
export {
	ConfigurationError,
	InvalidConfigurationError,
	InvalidRegionError,
	MissingConfigurationError,
	MissingCredentialsError,
} from './ConfigurationError.js';

// Validation errors
export {
	InvalidFormatError,
	InvalidParameterError,
	MissingParameterError,
	OutOfRangeError,
	ValidationError,
} from './ValidationError.js';
