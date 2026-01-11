import { DeviceModel } from '../../roborockCommunication/Zmodel/deviceModel.js';
import { OutOfRangeError } from '../../errors/index.js';
import { BATTERY_THRESHOLD_WARNING } from '../../constants/index.js';

// Battery thresholds for device business logic
const BATTERY_LOW_THRESHOLD = BATTERY_THRESHOLD_WARNING; // 40%
const BATTERY_CRITICAL_THRESHOLD = 15; // Critical level for operations

/**
 * Operational states a vacuum device can be in.
 */
export enum OperationalState {
  Stopped = 'Stopped',
  Running = 'Running',
  Paused = 'Paused',
  Charging = 'Charging',
  Docked = 'Docked',
  Error = 'Error',
  Returning = 'Returning',
}

/**
 * Device capabilities configuration.
 */
export interface DeviceCapabilities {
  supportsRoomCleaning: boolean;
  supportsScenes: boolean;
  supportsCleanModeAdjustment: boolean;
  supportsMultipleFloors: boolean;
  hasSmartFeatures: boolean;
}

/**
 * Core vacuum device entity.
 * Encapsulates device state and business rules.
 */
export class VacuumDevice {
  private _batteryLevel: number;
  private _operationalState: OperationalState;
  private _isOnline: boolean;

  constructor(
    public readonly duid: string,
    public readonly name: string,
    public readonly model: DeviceModel,
    public readonly serialNumber: string,
    batteryLevel: number,
    operationalState: OperationalState,
    public readonly capabilities: DeviceCapabilities,
    isOnline = true,
  ) {
    this.validateBatteryLevel(batteryLevel);
    this._batteryLevel = batteryLevel;
    this._operationalState = operationalState;
    this._isOnline = isOnline;
  }

  /**
   * Current battery level (0-100).
   */
  get batteryLevel(): number {
    return this._batteryLevel;
  }

  /**
   * Current operational state.
   */
  get operationalState(): OperationalState {
    return this._operationalState;
  }

  /**
   * Whether device is currently online.
   */
  get isOnline(): boolean {
    return this._isOnline;
  }

  /**
   * Update battery level with validation.
   * @param level - Battery percentage (0-100)
   * @throws {OutOfRangeError} If level is not between 0 and 100
   */
  updateBatteryLevel(level: number): void {
    this.validateBatteryLevel(level);
    this._batteryLevel = level;
  }

  /**
   * Update operational state.
   * @param state - New operational state
   */
  updateOperationalState(state: OperationalState): void {
    this._operationalState = state;
  }

  /**
   * Update online status.
   * @param online - Whether device is online
   */
  updateOnlineStatus(online: boolean): void {
    this._isOnline = online;
  }

  /**
   * Check if battery is low (below threshold).
   */
  get isBatteryLow(): boolean {
    return this._batteryLevel <= BATTERY_LOW_THRESHOLD;
  }

  /**
   * Check if battery is critical (below critical threshold).
   */
  get isBatteryCritical(): boolean {
    return this._batteryLevel <= BATTERY_CRITICAL_THRESHOLD;
  }

  /**
   * Check if device is currently charging.
   */
  get isCharging(): boolean {
    return this._operationalState === OperationalState.Charging;
  }

  /**
   * Check if device is docked.
   */
  get isDocked(): boolean {
    return this._operationalState === OperationalState.Docked;
  }

  /**
   * Check if device is in error state.
   */
  get hasError(): boolean {
    return this._operationalState === OperationalState.Error;
  }

  /**
   * Check if device can start cleaning.
   * Business rule: Device must have sufficient battery, be online, and not in error state.
   */
  canStartCleaning(): boolean {
    return (
      this._isOnline &&
      !this.hasError &&
      !this.isBatteryCritical &&
      (this._operationalState === OperationalState.Stopped || this._operationalState === OperationalState.Docked || this._operationalState === OperationalState.Paused)
    );
  }

  /**
   * Check if device can pause current operation.
   */
  canPause(): boolean {
    return this._isOnline && this._operationalState === OperationalState.Running;
  }

  /**
   * Check if device can resume cleaning.
   */
  canResume(): boolean {
    return this._isOnline && !this.hasError && this._operationalState === OperationalState.Paused;
  }

  /**
   * Check if device can return to dock.
   */
  canReturnToDock(): boolean {
    return (
      this._isOnline &&
      !this.hasError &&
      this._operationalState !== OperationalState.Charging &&
      this._operationalState !== OperationalState.Docked &&
      this._operationalState !== OperationalState.Returning
    );
  }

  /**
   * Validate battery level is within valid range.
   * @param level - Battery percentage to validate
   * @throws {OutOfRangeError} If level is not between 0 and 100
   */
  private validateBatteryLevel(level: number): void {
    if (level < 0 || level > 100) {
      throw new OutOfRangeError('batteryLevel', level, 0, 100);
    }
  }

  /**
   * Convert entity to plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      duid: this.duid,
      name: this.name,
      model: this.model,
      serialNumber: this.serialNumber,
      batteryLevel: this._batteryLevel,
      operationalState: this._operationalState,
      isOnline: this._isOnline,
      capabilities: this.capabilities,
    };
  }
}
