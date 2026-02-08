/** API response: Room from home data */
export interface RoomDto {
  /** Global room ID (cloud/home-level) */
  id: number;
  /** Room name */
  name: string | undefined;
}
