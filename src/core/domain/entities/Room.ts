/**
 * Domain entity representing a room in a Apple Home.
 */
export class RoomEntity {
  constructor(
    public readonly id: number,
    public readonly name: string | undefined,
  ) {}
}
