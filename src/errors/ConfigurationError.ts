import { BaseError } from './BaseError.js';

/**
 * Base class for configuration-related errors.
 */
export class ConfigurationError extends BaseError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, 'CONFIG_ERROR', 400, metadata);
  }
}

/**
 * Thrown when required configuration field is missing.
 */
export class MissingConfigurationError extends ConfigurationError {
  constructor(field: string) {
    super(`Required configuration field is missing: ${field}`, {
      reason: 'MISSING_FIELD',
      field,
    });
  }
}

/**
 * Thrown when configuration value is invalid.
 */
export class InvalidConfigurationError extends ConfigurationError {
  constructor(field: string, value: unknown, expectedFormat?: string) {
    super(`Invalid configuration value for field: ${field}`, {
      reason: 'INVALID_VALUE',
      field,
      value,
      expectedFormat,
    });
  }
}

/**
 * Thrown when credentials are missing from configuration.
 */
export class MissingCredentialsError extends ConfigurationError {
  constructor() {
    super('Authentication credentials are missing. Please provide username and password or verification code.', {
      reason: 'MISSING_CREDENTIALS',
    });
  }
}

/**
 * Thrown when region configuration is invalid.
 */
export class InvalidRegionError extends ConfigurationError {
  constructor(region: string, validRegions: string[]) {
    super(`Invalid region: ${region}. Valid regions: ${validRegions.join(', ')}`, {
      reason: 'INVALID_REGION',
      region,
      validRegions,
    });
  }
}
