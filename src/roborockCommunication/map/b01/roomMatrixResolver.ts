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
 * `ySign` defaults to +1 (world-Y increases upward assumption) — UNCONFIRMED, see
 * requirement.md point 4. Exposed as a parameter (not hardcoded) so the CLI validation tool
 * can compare +1 vs -1 against real-device ground truth before this ships trusted.
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

	const pixelX = Math.round(pose.x / resolutionMmPerPixel + originX);
	const pixelY = Math.round(originY - ySign * (pose.y / resolutionMmPerPixel));

	if (pixelX < 0 || pixelX >= roomMatrix.width || pixelY < 0 || pixelY >= roomMatrix.height) return undefined;

	const index = pixelY * roomMatrix.width + pixelX;
	const byteValue = roomMatrix.data[index];
	if (byteValue === undefined) return undefined;

	const classification = classifyGridByte(byteValue);
	return classification.kind === 'room' ? classification.roomId : undefined;
}
