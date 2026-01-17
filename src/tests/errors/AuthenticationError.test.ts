import { describe, it, expect } from 'vitest';
import {
  AuthenticationError,
  VerificationCodeExpiredError,
  InvalidCredentialsError,
  InvalidVerificationCodeError,
  TokenExpiredError,
  RateLimitExceededError,
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

  describe('InvalidVerificationCodeError', () => {
    it('should create error without code', () => {
      const error = new InvalidVerificationCodeError();

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Invalid verification code format. Expected 6 digits.');
      expect(error.metadata).toEqual({
        reason: 'INVALID_CODE_FORMAT',
        providedCode: undefined,
      });
    });

    it('should create error with provided code', () => {
      const error = new InvalidVerificationCodeError('abc123');

      expect(error.message).toBe('Invalid verification code format. Expected 6 digits.');
      expect(error.metadata).toEqual({
        reason: 'INVALID_CODE_FORMAT',
        providedCode: 'abc123',
      });
    });

    it('should handle empty string code', () => {
      const error = new InvalidVerificationCodeError('');

      expect(error.metadata?.providedCode).toBe('');
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

  describe('RateLimitExceededError', () => {
    it('should create error without retry time', () => {
      const error = new RateLimitExceededError();

      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe('Too many authentication attempts. Please try again later.');
      expect(error.metadata).toEqual({
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: undefined,
      });
    });

    it('should create error with retry time', () => {
      const error = new RateLimitExceededError(300);

      expect(error.message).toBe('Too many authentication attempts. Please try again later.');
      expect(error.metadata).toEqual({
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 300,
      });
    });

    it('should handle different retry times', () => {
      const error = new RateLimitExceededError(60);

      expect(error.metadata?.retryAfter).toBe(60);
    });
  });

  describe('error hierarchy', () => {
    it('should maintain proper inheritance chain', () => {
      const errors = [new VerificationCodeExpiredError(), new InvalidCredentialsError(), new InvalidVerificationCodeError(), new TokenExpiredError(), new RateLimitExceededError()];

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(AuthenticationError);
      });
    });

    it('should all have AUTH_ERROR code', () => {
      const errors = [new VerificationCodeExpiredError(), new InvalidCredentialsError(), new InvalidVerificationCodeError(), new TokenExpiredError(), new RateLimitExceededError()];

      errors.forEach((error) => {
        expect(error.code).toBe('AUTH_ERROR');
        expect(error.statusCode).toBe(401);
      });
    });
  });
});
