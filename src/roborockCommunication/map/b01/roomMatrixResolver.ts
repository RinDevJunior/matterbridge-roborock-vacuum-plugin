import type { GridCalibration } from './q10GridCalibration.js';
import { worldToPixel } from './q10GridCalibration.js';
import type { B01Pose, B01RoomMatrix } from './types.js';

/**
 * Resolve a live robot pose to a room ID using the decoded roomMatrix grid and a resolved
 * calibration. MUST NEVER THROW. Returns undefined whenever the pose, matrix, or calibration is
 * missing/malformed, or the resulting cell does not decode to a known room ID — a wrong room ID
 * is worse than no room ID, since it would silently corrupt `currentArea`.
 */
export function resolveRoomFromPose(
	pose: B01Pose | undefined,
	roomMatrix: B01RoomMatrix | undefined,
	calibration: GridCalibration | undefined,
): number | undefined {
	if (!pose || !roomMatrix || !calibration) return undefined;
	if (typeof pose.x !== 'number' || typeof pose.y !== 'number') return undefined;
	if (!Buffer.isBuffer(roomMatrix.data) || roomMatrix.data.length === 0) return undefined;
	if (roomMatrix.width <= 0 || roomMatrix.height <= 0) return undefined;

	const pixel = worldToPixel({ x: pose.x, y: pose.y }, roomMatrix, calibration);
	if (!pixel) return undefined;

	const idx = pixel.py * roomMatrix.width + pixel.px;
	if (idx < 0 || idx >= roomMatrix.data.length) return undefined;

	const roomId = (roomMatrix.data[idx] & 0xfc) >> 2;
	return roomMatrix.roomIds.includes(roomId) ? roomId : undefined;
}
