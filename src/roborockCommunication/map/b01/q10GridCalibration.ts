import { B01TracePoint } from './b01Q10TraceParser.js';
import { B01RoomMatrix } from './types.js';

const MIN_RESOLUTION = 12.0;
const MAX_RESOLUTION = 26.0;
const RESOLUTION_STEP = 0.5;
const RESOLUTION_ANCHOR = 20.0;
const MIN_POINTS_REQUIRED = 4;

export interface GridCalibration {
	resolution: number;
	ySign: 1 | -1;
}

/**
 * Convert a raw trace point (robot-space coordinates) into grid pixel coordinates using a
 * resolved calibration. MUST NEVER THROW — returns `undefined` on any out-of-bounds result.
 */
export function worldToPixel(
	point: { x: number; y: number },
	roomMatrix: B01RoomMatrix,
	calibration: GridCalibration,
): { px: number; py: number } | undefined {
	const px = Math.round((point.x - roomMatrix.originX) / calibration.resolution);
	const py = Math.round((calibration.ySign * (point.y - roomMatrix.originY)) / calibration.resolution);

	if (px < 0 || px >= roomMatrix.width || py < 0 || py >= roomMatrix.height) {
		return undefined;
	}

	return { px, py };
}

/**
 * Search candidate resolutions (12.0-26.0 trace-units/pixel, step 0.5) x Y-sign to find the
 * combination that lands the most trace points on real room cells. MUST NEVER THROW — returns
 * `undefined` when there is not enough data to calibrate confidently.
 */
export function solveQ10GridCalibration(
	points: B01TracePoint[],
	roomMatrix: B01RoomMatrix,
): GridCalibration | undefined {
	if (points.length < MIN_POINTS_REQUIRED || roomMatrix.data.length === 0) {
		return undefined;
	}

	let bestCandidate: GridCalibration | undefined;
	let bestScore = 0;

	for (let resolution = MIN_RESOLUTION; resolution <= MAX_RESOLUTION; resolution += RESOLUTION_STEP) {
		for (const ySign of [1, -1] as const) {
			const candidate: GridCalibration = { resolution, ySign };
			let score = 0;

			for (const point of points) {
				const pixel = worldToPixel(point, roomMatrix, candidate);
				if (!pixel) {
					continue;
				}
				const idx = pixel.py * roomMatrix.width + pixel.px;
				if (idx < 0 || idx >= roomMatrix.data.length) {
					continue;
				}
				const roomId = (roomMatrix.data[idx] & 0xfc) >> 2;
				if (roomMatrix.roomIds.includes(roomId)) {
					score++;
				}
			}

			if (
				score > bestScore ||
				(score === bestScore &&
					bestCandidate &&
					Math.abs(resolution - RESOLUTION_ANCHOR) < Math.abs(bestCandidate.resolution - RESOLUTION_ANCHOR))
			) {
				bestScore = score;
				bestCandidate = candidate;
			}
		}
	}

	return bestScore > 0 ? bestCandidate : undefined;
}
