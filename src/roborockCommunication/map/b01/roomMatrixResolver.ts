import type { B01Pose, B01RoomMatrix } from './types.js';

/**
 * Resolve a live robot pose to a room ID using the decoded roomMatrix grid.
 * MUST NEVER THROW. Returns undefined whenever the pose or matrix is missing,
 * malformed, or the pixel encoding cannot be confidently resolved — the real
 * wire encoding of `roomMatrix` is unconfirmed against actual Q10 firmware
 * (no reference implementation researched decodes it either). This is an
 * intentional safe no-op until a real device capture (via the `b01-pose-info`
 * CLI command) confirms the byte layout. Do not guess here — a wrong room ID
 * is worse than no room ID, since it would silently corrupt `currentArea`.
 */
export function resolveRoomFromPose(
	pose: B01Pose | undefined,
	roomMatrix: B01RoomMatrix | undefined,
): number | undefined {
	if (!pose || !roomMatrix) return undefined;
	if (typeof pose.x !== 'number' || typeof pose.y !== 'number') return undefined;
	if (!Buffer.isBuffer(roomMatrix.data) || roomMatrix.data.length === 0) return undefined;

	// Intentionally unimplemented — see function doc comment.
	return undefined;
}
