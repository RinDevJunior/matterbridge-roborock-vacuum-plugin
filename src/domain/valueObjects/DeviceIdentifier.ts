import { ValidationError } from '../../errors/index.js';

/**
 * Value object representing a device unique identifier (duid).
 * Ensures duid is always valid and provides type safety.
 */
export class DeviceIdentifier {
  private readonly _value: string;

  constructor(duid: string) {
    this.validate(duid);
    this._value = duid;
  }

  /**
   * Get the duid value.
   */
  get value(): string {
    return this._value;
  }

  /**
   * Validate duid format.
   * @throws {ValidationError} If duid is empty or invalid format
   */
  private validate(duid: string): void {
    if (!duid || duid.trim().length === 0) {
      throw new ValidationError('Device identifier cannot be empty', {
        providedValue: duid,
      });
    }

    // Roborock duids are typically alphanumeric
    if (!/^[a-zA-Z0-9_-]+$/.test(duid)) {
      throw new ValidationError('Device identifier contains invalid characters', {
        providedValue: duid,
        expectedFormat: 'alphanumeric with hyphens or underscores',
      });
    }
  }

  /**
   * Check equality with another DeviceIdentifier.
   */
  equals(other: DeviceIdentifier): boolean {
    return this._value === other._value;
  }

  /**
   * Convert to string representation.
   */
  toString(): string {
    return this._value;
  }

  /**
   * Convert to JSON (returns the raw value).
   */
  toJSON(): string {
    return this._value;
  }

  /**
   * Create DeviceIdentifier from string (factory method).
   */
  static from(duid: string): DeviceIdentifier {
    return new DeviceIdentifier(duid);
  }
}
