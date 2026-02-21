export type CleanCommand =
  | { type: 'routine'; routineId: number }
  | { type: 'room'; roomIds: number[] }
  | { type: 'global' };
export type CleanSelection = { type: 'routine'; areaId: number } | { type: 'room'; roomId: number };
