import { B01MapInfo, B01Pose } from './types.js';

const TRACE_HEADER_LENGTH = 14;
const TRACE_SEQUENCE_OFFSET = 3;
const TRACE_HEADING_OFFSET = 10;
const POINT_SIZE = 4;

/**
 * A single (x, y) coordinate pair from a Q10 trace packet. Trace packets do not carry heading
 * (phi), so this interface omits it unlike B01Pose.
 */
export interface B01TracePoint {
	x: number;
	y: number;
}

/**
 * Parse the header + point-pair body of a Q10 trace packet (marker 0x02 0x01).
 *
 * Throws a plain `Error` (message starting with `Q10 trace packet:`) on invalid marker/header or
 * a malformed (non-multiple-of-4) point body — callers (via B01MapParser.parseTraceBinary) must
 * catch and wraps with `{ cause: err }` to preserve the original error chain.
 *
 * @param payload Buffer containing the complete trace packet (header + body).
 * @returns An object containing the session counter, heading (s16be, offset 10-11), and the list
 *          of trace points.
 */
export function parseTracePacket(payload: Buffer): {
	sessionCounter: number;
	heading: number;
	points: B01TracePoint[];
} {
	if (payload.length < TRACE_HEADER_LENGTH || payload[0] !== 0x02 || payload[1] !== 0x01) {
		throw new Error('Q10 trace packet: invalid header or unrecognized marker bytes');
	}

	const sessionCounter = payload.readUInt8(TRACE_SEQUENCE_OFFSET);
	const heading = payload.readInt16BE(TRACE_HEADING_OFFSET);
	const body = payload.subarray(TRACE_HEADER_LENGTH);

	if (body.length % POINT_SIZE !== 0) {
		throw new Error('Q10 trace packet: body length is not a multiple of 4 (malformed point pairs)');
	}

	const points: B01TracePoint[] = [];
	for (let offset = 0; offset < body.length; offset += POINT_SIZE) {
		points.push({
			x: body.readInt16BE(offset),
			y: body.readInt16BE(offset + 2),
		});
	}

	return { sessionCounter, heading, points };
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
	const { heading, points } = parseTracePacket(payload);
	const lastPoint = points.at(-1);
	const currentPose: B01Pose | undefined = lastPoint ? { x: lastPoint.x, y: lastPoint.y, phi: heading } : undefined;

	return { rooms: [], mapId: undefined, currentPose, roomMatrix: undefined };
}
