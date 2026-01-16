import { ValidationError, InvalidParameterError } from '../../errors/index.js';

/**
 * Type of cleaning routine/scene.
 */
export enum RoutineType {
  Scheduled = 'Scheduled', // Time-based routine
  Custom = 'Custom', // User-defined routine
  Quick = 'Quick', // Quick clean preset
}

/**
 * Represents a cleaning routine/scene.
 * A routine defines a predefined cleaning pattern with specific rooms and settings.
 */
export class CleaningRoutine {
  constructor(
    public readonly routineId: number,
    public readonly name: string,
    public readonly roomIds: number[],
    public readonly type: RoutineType = RoutineType.Custom,
    public readonly isEnabled = true,
  ) {
    this.validateRoutineId(routineId);
    this.validateName(name);
    this.validateRoomIds(roomIds);
  }

  /**
   * Validate routine ID is positive.
   * @throws {InvalidParameterError} If routine ID is not positive
   */
  private validateRoutineId(routineId: number): void {
    if (routineId <= 0) {
      throw new InvalidParameterError('routineId', routineId, 'Routine ID must be a positive integer');
    }
  }

  /**
   * Validate routine name is not empty.
   * @throws {ValidationError} If name is empty
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Routine name cannot be empty', {
        routineId: this.routineId,
      });
    }
  }

  /**
   * Validate room IDs array is not empty and contains valid IDs.
   * @throws {ValidationError} If roomIds is empty or contains invalid IDs
   */
  private validateRoomIds(roomIds: number[]): void {
    if (!roomIds || roomIds.length === 0) {
      throw new ValidationError('Routine must include at least one room', {
        routineId: this.routineId,
      });
    }

    const invalidIds = roomIds.filter((id) => id <= 0);
    if (invalidIds.length > 0) {
      throw new ValidationError('Routine contains invalid room IDs', {
        routineId: this.routineId,
        invalidIds,
      });
    }
  }

  /**
   * Check if routine includes a specific room.
   * @param roomId - Room ID to check
   */
  includesRoom(roomId: number): boolean {
    return this.roomIds.includes(roomId);
  }

  /**
   * Get number of rooms in this routine.
   */
  get roomCount(): number {
    return this.roomIds.length;
  }

  /**
   * Create a display label for UI.
   */
  getDisplayLabel(): string {
    const roomCountText = this.roomCount === 1 ? '1 room' : `${this.roomCount} rooms`;
    return `${this.name} (${roomCountText})`;
  }

  /**
   * Convert entity to plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      routineId: this.routineId,
      name: this.name,
      roomIds: this.roomIds,
      type: this.type,
      isEnabled: this.isEnabled,
      roomCount: this.roomCount,
    };
  }

  /**
   * Check equality with another CleaningRoutine.
   */
  equals(other: CleaningRoutine): boolean {
    return (
      this.routineId === other.routineId &&
      this.name === other.name &&
      this.type === other.type &&
      this.roomIds.length === other.roomIds.length &&
      this.roomIds.every((id, index) => id === other.roomIds[index])
    );
  }
}
