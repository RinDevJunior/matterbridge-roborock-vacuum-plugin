/**
 * Domain entity representing a room in a home.
 */
export interface RoomEntity {
  /** Unique room identifier (global ID) */
  readonly id: number;

  /** Room name */
  readonly name: string;
}
