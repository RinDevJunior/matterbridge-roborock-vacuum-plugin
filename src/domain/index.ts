/**
 * Domain layer module.
 *
 * Contains business entities, value objects, and domain logic.
 * Follows Domain-Driven Design principles with clear separation between
 * entities (with identity) and value objects (immutable, compared by value).
 *
 * @example
 * ```typescript
 * import { VacuumDevice, OperationalState, BatteryStatus } from './domain';
 *
 * const battery = BatteryStatus.from(80, false);
 * const device = new VacuumDevice(
 *   'abc123',
 *   'Living Room Vacuum',
 *   model,
 *   serialNumber,
 *   battery.percentage,
 *   OperationalState.Stopped,
 *   capabilities
 * );
 *
 * if (device.canStartCleaning()) {
 *   // Start cleaning operation
 * }
 * ```
 */

// Re-export entities
export * from './entities/index.js';

// Re-export value objects
export * from './valueObjects/index.js';
