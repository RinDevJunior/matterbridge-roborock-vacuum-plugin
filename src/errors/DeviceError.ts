import { BaseError } from './BaseError.js';

/** Base error for device operations. */
export class DeviceError extends BaseError {
  constructor(
    message: string,
    public readonly duid?: string,
    metadata?: Record<string, unknown>,
  ) {
    super(message, 'DEVICE_ERROR', 500, { ...metadata, duid });
  }
}

/** Device not found in user's account. */
export class DeviceNotFoundError extends DeviceError {
  constructor(duid: string) {
    super(`Device not found: ${duid}`, duid, {
      reason: 'NOT_FOUND',
    });
  }
}

/** Device connection failed. */
export class DeviceConnectionError extends DeviceError {
  constructor(duid: string, reason: string, details?: Record<string, unknown>) {
    super(`Failed to connect to device: ${duid}. ${reason}`, duid, {
      reason: 'CONNECTION_FAILED',
      connectionReason: reason,
      ...details,
    });
  }
}

/** Device is offline or unreachable. */
export class DeviceOfflineError extends DeviceError {
  constructor(duid: string) {
    super(`Device is offline: ${duid}`, duid, {
      reason: 'DEVICE_OFFLINE',
    });
  }
}

/** Device command failed. */
export class DeviceCommandError extends DeviceError {
  constructor(duid: string, command: string, reason?: string) {
    super(`Command failed for device ${duid}: ${command}. ${reason ?? ''}`, duid, {
      reason: 'COMMAND_FAILED',
      command,
      commandReason: reason,
    });
  }
}

/** Device model not supported. */
export class UnsupportedDeviceError extends DeviceError {
  constructor(model: string, duid?: string) {
    super(`Device model is not supported: ${model}`, duid, {
      reason: 'UNSUPPORTED_MODEL',
      model,
    });
  }
}

/** Device initialization failed. */
export class DeviceInitializationError extends DeviceError {
  constructor(duid: string, reason: string) {
    super(`Failed to initialize device: ${duid}. ${reason}`, duid, {
      reason: 'INITIALIZATION_FAILED',
      initReason: reason,
    });
  }
}
