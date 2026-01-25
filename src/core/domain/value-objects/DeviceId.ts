/**
 * Value object representing a device identifier (DUID).
 * Ensures device IDs are valid and immutable.
 */
export class DeviceId {
  private constructor(private readonly value: string) {}

  /**
   * Create a DeviceId from a string.
   * @throws Error if the device ID is invalid
   */
  public static create(duid: string): DeviceId {
    if (!duid || typeof duid !== 'string') {
      throw new Error('Device ID is required and must be a string');
    }

    const trimmed = duid.trim();
    if (trimmed.length < 5) {
      throw new Error('Device ID must be at least 5 characters long');
    }

    return new DeviceId(trimmed);
  }

  /**
   * Get the string representation of this device ID.
   */
  public toString(): string {
    return this.value;
  }

  /**
   * Check if two DeviceIds are equal.
   */
  public equals(other: DeviceId): boolean {
    return this.value === other.value;
  }
}
