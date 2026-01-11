import { BaseError } from './BaseError.js';

/**
 * Base class for validation errors.
 */
export class ValidationError extends BaseError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, metadata);
  }
}

/**
 * Thrown when input parameter is invalid.
 */
export class InvalidParameterError extends ValidationError {
  constructor(parameterName: string, value: unknown, reason?: string) {
    super(`Invalid parameter: ${parameterName}. ${reason ?? ''}`, {
      reason: 'INVALID_PARAMETER',
      parameterName,
      value,
      validationReason: reason,
    });
  }
}

/**
 * Thrown when numeric value is out of valid range.
 */
export class OutOfRangeError extends ValidationError {
  constructor(parameterName: string, value: number, min: number, max: number) {
    super(`Parameter ${parameterName} is out of range. Expected: ${min}-${max}, got: ${value}`, {
      reason: 'OUT_OF_RANGE',
      parameterName,
      value,
      min,
      max,
    });
  }
}

/**
 * Thrown when required parameter is missing.
 */
export class MissingParameterError extends ValidationError {
  constructor(parameterName: string) {
    super(`Required parameter is missing: ${parameterName}`, {
      reason: 'MISSING_PARAMETER',
      parameterName,
    });
  }
}

/**
 * Thrown when data format is invalid.
 */
export class InvalidFormatError extends ValidationError {
  constructor(data: string, expectedFormat: string) {
    super(`Invalid data format. Expected: ${expectedFormat}`, {
      reason: 'INVALID_FORMAT',
      data,
      expectedFormat,
    });
  }
}
