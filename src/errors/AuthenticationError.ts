import { BaseError } from './BaseError.js';

/** Base error for authentication failures. */
export class AuthenticationError extends BaseError {
	constructor(message: string, metadata?: Record<string, unknown>) {
		super(message, 'AUTH_ERROR', 401, metadata);
	}
}

/** Verification code has expired. */
export class VerificationCodeExpiredError extends AuthenticationError {
	constructor(email?: string) {
		super('Verification code has expired. Please request a new code.', {
			reason: 'CODE_EXPIRED',
			email,
		});
	}
}

/** Invalid username or password. */
export class InvalidCredentialsError extends AuthenticationError {
	constructor(username?: string) {
		super('Invalid username or password. Please check your credentials.', {
			reason: 'INVALID_CREDENTIALS',
			username,
		});
	}
}

/** Auth token has expired. */
export class TokenExpiredError extends AuthenticationError {
	constructor() {
		super('Authentication token has expired. Please log in again.', {
			reason: 'TOKEN_EXPIRED',
		});
	}
}
