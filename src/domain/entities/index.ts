/**
 * Domain entities module.
 *
 * Provides core business entities that encapsulate domain logic and business rules.
 * Entities have identity, lifecycle, and enforce invariants through their methods.
 *
 * @example
 * ```typescript
 * import { VacuumDevice, CleaningSession, RoomEntity } from './domain/entities';
 *
 * const device = new VacuumDevice('abc123', 'Living Room Vacuum', model, serialNumber, 85, OperationalState.Stopped, capabilities);
 *
 * if (device.canStartCleaning()) {
 *   const session = new CleaningSession(sessionId, device.duid, CleaningType.Room, [1, 2, 3]);
 *   session.start();
 * }
 * ```
 */

export { VacuumDevice, OperationalState, DeviceCapabilities } from './VacuumDevice.js';
export { CleaningSession, CleaningStatus, CleaningType } from './CleaningSession.js';
export { RoomEntity } from './RoomEntity.js';
export { CleaningRoutine, RoutineType } from './CleaningRoutine.js';
