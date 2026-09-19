import { ROBOROCK_COORDINATE_OFFSET_MM } from './b01Q10TraceParser.js';
import type { B01Pose, B01RoomMatrix } from './types.js';

export type GridCellKind = 'unknown' | 'background' | 'floor' | 'wall' | 'room';
export interface GridCellClassification {
	kind: GridCellKind;
	roomId?: number;
}

const GRID_UNKNOWN = 0;
const GRID_BACKGROUND = 243;
const GRID_FLOOR_UNSEGMENTED = 240;
const GRID_WALL_MIN = 240;

export function classifyGridByte(value: number): GridCellClassification {
	if (value === GRID_UNKNOWN) return { kind: 'unknown' };
	if (value === GRID_BACKGROUND) return { kind: 'background' };
	if (value === GRID_FLOOR_UNSEGMENTED) return { kind: 'floor' };
	if (value >= GRID_WALL_MIN) return { kind: 'wall' };
	return { kind: 'room', roomId: value >> 2 };
}

/**
 * Resolve a live robot pose (already in Roborock-common mm) to a room ID using the decoded
 * roomMatrix grid + header-derived origin/resolution. Returns undefined whenever pose, matrix,
 * or origin is missing/malformed, or the resolved pixel does not land on a 'room'-classified
 * cell (this is a deliberate plausibility guard, not a full correctness proof — see plan.md
 * Validation Plan; a wrong room ID is worse than no room ID).
 *
 * **Coordinate frame transformation:** The input `pose` is received in Roborock-common mm
 * (offset by +25500 from the device's raw native frame). The `roomMatrix.origin` is expressed
 * in the device's raw native frame. This function internally converts the pose back to the raw
 * frame by subtracting `ROBOROCK_COORDINATE_OFFSET_MM` before applying the origin and
 * resolution to compute grid pixel coordinates.
 *
 * `ySign` defaults to +1 (world-Y increases upward assumption) — verified correct via
 * real-device validation on Roborock Q10 S5+, and independently confirmed on a second Q10 S5+ unit.
 * Exposed as a parameter (not hardcoded) so the
 * CLI validation tool can compare outcomes against ground truth if needed.
 */
export function resolveRoomFromPose(
	pose: B01Pose | undefined,
	roomMatrix: B01RoomMatrix | undefined,
	ySign: 1 | -1 = 1,
): number | undefined {
	if (!pose || !roomMatrix) return undefined;
	if (typeof pose.x !== 'number' || typeof pose.y !== 'number') return undefined;
	if (!Buffer.isBuffer(roomMatrix.data) || roomMatrix.data.length === 0) return undefined;
	if (!roomMatrix.origin) return undefined;
	if (roomMatrix.width <= 0 || roomMatrix.height <= 0) return undefined;

	const { x: originX, y: originY, resolutionMmPerPixel } = roomMatrix.origin;
	if (resolutionMmPerPixel <= 0) return undefined;

	// Convert pose from Roborock-common mm back to device's raw native frame
	const worldX = pose.x - ROBOROCK_COORDINATE_OFFSET_MM;
	const worldY = pose.y - ROBOROCK_COORDINATE_OFFSET_MM;

	const pixelX = Math.round(worldX / resolutionMmPerPixel + originX);
	const pixelY = Math.round(originY - ySign * (worldY / resolutionMmPerPixel));

	if (pixelX < 0 || pixelX >= roomMatrix.width || pixelY < 0 || pixelY >= roomMatrix.height) return undefined;

	const index = pixelY * roomMatrix.width + pixelX;
	const byteValue = roomMatrix.data[index];
	if (byteValue === undefined) return undefined;

	const classification = classifyGridByte(byteValue);
	return classification.kind === 'room' ? classification.roomId : undefined;
}
