import { ValidationError, InvalidParameterError } from '../../errors/index.js';

/**
 * Represents a room/area in a vacuum's floor map.
 */
export class RoomEntity {
  constructor(
    public readonly roomId: number,
    public readonly globalId: number,
    public readonly name: string,
    public readonly floorId?: number,
  ) {
    this.validateRoomId(roomId);
    this.validateName(name);
  }

  /**
   * Validate room ID is positive.
   * @throws {InvalidParameterError} If room ID is not positive
   */
  private validateRoomId(roomId: number): void {
    if (roomId <= 0) {
      throw new InvalidParameterError('roomId', roomId, 'Room ID must be a positive integer');
    }
  }

  /**
   * Validate room name is not empty.
   * @throws {ValidationError} If name is empty
   */
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Room name cannot be empty', {
        roomId: this.roomId,
      });
    }
  }

  /**
   * Check if this room matches the given ID (either roomId or globalId).
   * @param id - ID to match against
   */
  matchesId(id: number): boolean {
    return this.roomId === id || this.globalId === id;
  }

  /**
   * Create a display label for UI (includes floor if available).
   */
  getDisplayLabel(): string {
    return this.floorId !== undefined ? `${this.name} (Floor ${this.floorId})` : this.name;
  }

  /**
   * Convert entity to plain object for serialization.
   */
  toJSON(): Record<string, unknown> {
    return {
      roomId: this.roomId,
      globalId: this.globalId,
      name: this.name,
      floorId: this.floorId,
    };
  }

  /**
   * Check equality with another RoomEntity.
   */
  equals(other: RoomEntity): boolean {
    return this.roomId === other.roomId && this.globalId === other.globalId && this.floorId === other.floorId;
  }
}
