import { OutOfRangeError } from '../../errors/index.js';
import { BATTERY_THRESHOLD_WARNING, BATTERY_THRESHOLD_OK } from '../../constants/index.js';

/**
 * Battery status classification.
 */
export enum BatteryLevel {
  Critical = 'Critical', // < 15%
  Low = 'Low', // 15-39%
  Normal = 'Normal', // 40-69%
  Good = 'Good', // 70-99%
  Full = 'Full', // 100%
}

/**
 * Value object representing battery status.
 * Immutable representation of battery state with derived properties.
 */
export class BatteryStatus {
  private static readonly CRITICAL_THRESHOLD = 15;

  constructor(
    public readonly percentage: number,
    public readonly isCharging: boolean,
  ) {
    this.validatePercentage(percentage);
  }

  /**
   * Validate battery percentage is within valid range.
   * @throws {OutOfRangeError} If percentage is not between 0 and 100
   */
  private validatePercentage(percentage: number): void {
    if (percentage < 0 || percentage > 100) {
      throw new OutOfRangeError('batteryPercentage', percentage, 0, 100);
    }
  }

  /**
   * Get battery level classification.
   */
  get level(): BatteryLevel {
    if (this.percentage === 100) return BatteryLevel.Full;
    if (this.percentage >= BATTERY_THRESHOLD_OK) return BatteryLevel.Good;
    if (this.percentage >= BATTERY_THRESHOLD_WARNING) return BatteryLevel.Normal;
    if (this.percentage >= BatteryStatus.CRITICAL_THRESHOLD) return BatteryLevel.Low;
    return BatteryLevel.Critical;
  }

  /**
   * Check if battery is low (below warning threshold).
   */
  get isLow(): boolean {
    return this.percentage < BATTERY_THRESHOLD_WARNING;
  }

  /**
   * Check if battery is critical (below critical threshold).
   */
  get isCritical(): boolean {
    return this.percentage < BatteryStatus.CRITICAL_THRESHOLD;
  }

  /**
   * Check if battery is full.
   */
  get isFull(): boolean {
    return this.percentage === 100;
  }

  /**
   * Check if battery is healthy (above OK threshold).
   */
  get isHealthy(): boolean {
    return this.percentage >= BATTERY_THRESHOLD_OK;
  }

  /**
   * Get human-readable status description.
   */
  getDescription(): string {
    if (this.isCharging) {
      return `Charging (${this.percentage}%)`;
    }
    return `${this.level} (${this.percentage}%)`;
  }

  /**
   * Check if device should return to dock (low battery and not charging).
   */
  shouldReturnToDock(): boolean {
    return this.isLow && !this.isCharging;
  }

  /**
   * Check if device has sufficient battery for operation.
   */
  hasSufficientBatteryFor(requiredPercentage: number): boolean {
    return this.percentage >= requiredPercentage;
  }

  /**
   * Check equality with another BatteryStatus.
   */
  equals(other: BatteryStatus): boolean {
    return this.percentage === other.percentage && this.isCharging === other.isCharging;
  }

  /**
   * Convert to JSON representation.
   */
  toJSON(): Record<string, unknown> {
    return {
      percentage: this.percentage,
      level: this.level,
      isCharging: this.isCharging,
      isLow: this.isLow,
      isCritical: this.isCritical,
      isFull: this.isFull,
    };
  }

  /**
   * Create BatteryStatus from percentage and charging state (factory method).
   */
  static from(percentage: number, isCharging: boolean): BatteryStatus {
    return new BatteryStatus(percentage, isCharging);
  }

  /**
   * Create BatteryStatus for fully charged battery.
   */
  static full(isCharging = false): BatteryStatus {
    return new BatteryStatus(100, isCharging);
  }

  /**
   * Create BatteryStatus for empty battery.
   */
  static empty(): BatteryStatus {
    return new BatteryStatus(0, false);
  }
}
