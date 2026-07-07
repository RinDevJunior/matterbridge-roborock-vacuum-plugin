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
	TokenExpiredError,
	VerificationCodeExpiredError,
} from './AuthenticationError.js';

// Device errors
export { DeviceConnectionError, DeviceError, DeviceInitializationError, DeviceNotFoundError } from './DeviceError.js';
