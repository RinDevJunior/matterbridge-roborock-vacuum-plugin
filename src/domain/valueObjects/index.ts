/**
 * Domain value objects module.
 *
 * Provides immutable value objects that represent domain concepts without identity.
 * Value objects are compared by their values, not by reference.
 *
 * @example
 * ```typescript
 * import { BatteryStatus, DeviceIdentifier, CleaningArea } from './domain/valueObjects';
 *
 * const battery = BatteryStatus.from(75, false);
 * if (battery.isHealthy) {
 *   console.log('Battery is good');
 * }
 *
 * const duid = DeviceIdentifier.from('abc123');
 * const area = CleaningArea.forRoom(1, 'Living Room');
 * ```
 */

export { DeviceIdentifier } from './DeviceIdentifier.js';
export { BatteryStatus, BatteryLevel } from './BatteryStatus.js';
export { CleaningArea, CleaningAreaCollection, AreaType } from './CleaningArea.js';
export { Coordinates, BoundingBox } from './Coordinates.js';
