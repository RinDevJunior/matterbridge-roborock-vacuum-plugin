/**
 * Domain entity representing a room in a home.
 */
export class RoomEntity {
  /** Unique room identifier (global ID) */
  /** Room name */
  constructor(
    public readonly id: number,
    public readonly name: string | undefined,
  ) {}
}
