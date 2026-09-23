import { B01MapInfo, B01Pose } from './types.js';

const TRACE_HEADER_LENGTH = 10;
const TRACE_SEQUENCE_OFFSET = 3;
const POINT_SIZE = 4;
const STRAY_POINT_MIN_COUNT = 3;
const STRAY_POINT_OUTLIER_MULTIPLIER = 20;

/**
 * A single (x, y) coordinate pair from a Q10 trace packet. Trace packets do not carry heading
 * (phi), so this interface omits it unlike B01Pose.
 */
export interface B01TracePoint {
	x: number;
	y: number;
}

/**
 * Parse the header + point-pair body of a Q10 trace packet (marker 0x02 0x01), applying the
 * stray-leading-point filter to remove an occasional outlier initial point caused by firmware
 * timing.
 *
 * Throws a plain `Error` (message starting with `Q10 trace packet:`) on invalid marker/header or
 * a malformed (non-multiple-of-4) point body — callers (via B01MapParser.parseTraceBinary) must
 * catch and wraps with `{ cause: err }` to preserve the original error chain.
 *
 * @param payload Buffer containing the complete trace packet (header + body).
 * @returns An object containing the session counter and the filtered list of trace points.
 */
export function parseTracePacket(payload: Buffer): { sessionCounter: number; points: B01TracePoint[] } {
	if (payload.length < TRACE_HEADER_LENGTH || payload[0] !== 0x02 || payload[1] !== 0x01) {
		throw new Error('Q10 trace packet: invalid header or unrecognized marker bytes');
	}

	const sessionCounter = payload.readUInt8(TRACE_SEQUENCE_OFFSET);
	const body = payload.subarray(TRACE_HEADER_LENGTH);

	if (body.length % POINT_SIZE !== 0) {
		throw new Error('Q10 trace packet: body length is not a multiple of 4 (malformed point pairs)');
	}

	const rawPoints: B01TracePoint[] = [];
	for (let offset = 0; offset < body.length; offset += POINT_SIZE) {
		rawPoints.push({
			x: body.readInt16BE(offset),
			y: body.readInt16BE(offset + 2),
		});
	}

	const points = dropStrayLeadingPoint(rawPoints);
	return { sessionCounter, points };
}

/**
 * Public entry point mirroring `parseQ10MapPacket` in `b01Q10MapParser.ts`. Wraps
 * `parseTracePacket`, taking the last point (current robot position) into `B01MapInfo.currentPose`.
 * `rooms` is always `[]` and `mapId`/`roomMatrix` are always `undefined` — trace packets carry no
 * room, map ID, or matrix data.
 *
 * Throws (does not swallow) on malformed input, same as `parseQ10MapPacket` — the caller
 * (B01MapParser.parseTraceBinary) is responsible for catching and wrapping with `{ cause: err }`.
 *
 * @param payload Buffer containing the complete Q10 trace packet.
 * @returns A B01MapInfo object with rooms=[], mapId=undefined, currentPose set from the last
 *          point (if any), and roomMatrix=undefined.
 */
export function parseQ10TracePacket(payload: Buffer): B01MapInfo {
	const { points } = parseTracePacket(payload);
	const lastPoint = points.at(-1);
	const currentPose: B01Pose | undefined = lastPoint ? { x: lastPoint.x, y: lastPoint.y } : undefined;

	return { rooms: [], mapId: undefined, currentPose, roomMatrix: undefined };
}

/**
 * Compute the Euclidean distance between two trace points.
 */
function distance(a: B01TracePoint, b: B01TracePoint): number {
	return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Calculate the median of a numeric array (standard even/odd split).
 */
function median(values: number[]): number {
	if (values.length === 0) {
		return 0;
	}
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Filter out the first point if it appears to be a stray outlier caused by firmware timing.
 * Only drops points[0] when ALL of:
 * - points.length >= 3
 * - the Euclidean step distance from points[0] to points[1] is > 20× the median step distance
 *   of the rest of the path (between points[1] and points[points.length-1], excluding the
 *   points[0]→points[1] step)
 * - guard: if the median of the rest-of-path steps is 0, do NOT drop (can't compute ratio).
 */
function dropStrayLeadingPoint(points: B01TracePoint[]): B01TracePoint[] {
	if (points.length < STRAY_POINT_MIN_COUNT) {
		return points;
	}

	const firstStep = distance(points[0], points[1]);
	const restSteps: number[] = [];
	for (let i = 1; i < points.length - 1; i++) {
		restSteps.push(distance(points[i], points[i + 1]));
	}

	if (restSteps.length === 0) {
		return points;
	}

	const medianRestStep = median(restSteps);
	if (medianRestStep > 0 && firstStep > medianRestStep * STRAY_POINT_OUTLIER_MULTIPLIER) {
		return points.slice(1);
	}

	return points;
}
