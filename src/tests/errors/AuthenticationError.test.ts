import { describe, expect, it } from 'vitest';

import {
	AuthenticationError,
	InvalidCredentialsError,
	TokenExpiredError,
	VerificationCodeExpiredError,
} from '../../errors/AuthenticationError.js';

describe('AuthenticationError', () => {
	describe('AuthenticationError', () => {
		it('should create error with message and metadata', () => {
			const error = new AuthenticationError('Auth failed', { userId: '123' });

			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe('Auth failed');
			expect(error.code).toBe('AUTH_ERROR');
			expect(error.statusCode).toBe(401);
			expect(error.metadata).toEqual({ userId: '123' });
		});

		it('should create error without metadata', () => {
			const error = new AuthenticationError('Unauthorized');

			expect(error.message).toBe('Unauthorized');
			expect(error.metadata).toBeUndefined();
		});
	});

	describe('VerificationCodeExpiredError', () => {
		it('should create error without email', () => {
			const error = new VerificationCodeExpiredError();

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe('Verification code has expired. Please request a new code.');
			expect(error.metadata).toEqual({
				reason: 'CODE_EXPIRED',
				email: undefined,
			});
		});

		it('should create error with email', () => {
			const error = new VerificationCodeExpiredError('user@example.com');

			expect(error.message).toBe('Verification code has expired. Please request a new code.');
			expect(error.metadata).toEqual({
				reason: 'CODE_EXPIRED',
				email: 'user@example.com',
			});
		});

		it('should have correct error properties', () => {
			const error = new VerificationCodeExpiredError('test@test.com');

			expect(error.code).toBe('AUTH_ERROR');
			expect(error.statusCode).toBe(401);
		});
	});

	describe('InvalidCredentialsError', () => {
		it('should create error without username', () => {
			const error = new InvalidCredentialsError();

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe('Invalid username or password. Please check your credentials.');
			expect(error.metadata).toEqual({
				reason: 'INVALID_CREDENTIALS',
				username: undefined,
			});
		});

		it('should create error with username', () => {
			const error = new InvalidCredentialsError('john.doe');

			expect(error.message).toBe('Invalid username or password. Please check your credentials.');
			expect(error.metadata).toEqual({
				reason: 'INVALID_CREDENTIALS',
				username: 'john.doe',
			});
		});
	});

	describe('TokenExpiredError', () => {
		it('should create token expired error', () => {
			const error = new TokenExpiredError();

			expect(error).toBeInstanceOf(AuthenticationError);
			expect(error.message).toBe('Authentication token has expired. Please log in again.');
			expect(error.metadata).toEqual({
				reason: 'TOKEN_EXPIRED',
			});
		});

		it('should have correct error properties', () => {
			const error = new TokenExpiredError();

			expect(error.code).toBe('AUTH_ERROR');
			expect(error.statusCode).toBe(401);
		});
	});

	describe('error hierarchy', () => {
		it('should maintain proper inheritance chain', () => {
			const errors = [new VerificationCodeExpiredError(), new InvalidCredentialsError(), new TokenExpiredError()];

			errors.forEach((error) => {
				expect(error).toBeInstanceOf(Error);
				expect(error).toBeInstanceOf(AuthenticationError);
			});
		});

		it('should all have AUTH_ERROR code', () => {
			const errors = [new VerificationCodeExpiredError(), new InvalidCredentialsError(), new TokenExpiredError()];

			errors.forEach((error) => {
				expect(error.code).toBe('AUTH_ERROR');
				expect(error.statusCode).toBe(401);
			});
		});
	});
});
