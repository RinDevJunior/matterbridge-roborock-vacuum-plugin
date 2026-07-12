import { decompressLZ4Block } from './lz4BlockDecompressor.js';
import { Q10GridCalibration, Q10MapPacket, Q10RobotPosition, Q10RoomInfo } from './types.js';

const MAP_PACKET_MARKER = [0x01, 0x01];
const TRACE_PACKET_MARKER = [0x02, 0x01];
const ROOM_RECORD_SIZE = 47;
const ROOM_NAME_LENGTH_OFFSET = 26;
const ROOM_NAME_OFFSET = 27;
const ROOM_PIXEL_MULTIPLIER = 4;
const ROOM_PIXEL_MASK = 0xff;
const TRACE_ORIGIN_UNIT_DIVISOR = 10;
const TRACE_POSITION_PIXEL_DIVISOR = 50;

export interface Q10GridPixel {
	px: number;
	py: number;
}

/**
 * Converts a raw Q10 trace position (millimetres) to grid-pixel coordinates.
 * Empirically verified (brute-forced against 54/54 real captured trace points —
 * see requirement.md "Validated position→pixel calibration"), NOT derived from
 * the Python reference's un-exercised header-calibration formula. Two distinct
 * unit systems: header origin_x/origin_y are 5mm units (÷10 → pixels); trace
 * point x/y are raw millimetres (÷50 → pixels, the true mm-per-pixel — do not
 * use the raw `resolution` header field (5) as the divisor here). Kept as its
 * own small named function so it is easy to correct if a future capture
 * (different map/session) contradicts it.
 */
export function q10PositionToGridPixel(position: Q10RobotPosition, calibration: Q10GridCalibration): Q10GridPixel {
	const originPxX = calibration.originX / TRACE_ORIGIN_UNIT_DIVISOR;
	const originPxY = calibration.originY / TRACE_ORIGIN_UNIT_DIVISOR;
	return {
		px: Math.round(-position.x / TRACE_POSITION_PIXEL_DIVISOR + originPxX),
		py: Math.round(originPxY + position.y / TRACE_POSITION_PIXEL_DIVISOR),
	};
}

export class Q10MapParser {
	public static isMapPacket(payload: Buffer): boolean {
		return payload.length >= 2 && payload[0] === MAP_PACKET_MARKER[0] && payload[1] === MAP_PACKET_MARKER[1];
	}

	public static isTracePacket(payload: Buffer): boolean {
		return payload.length >= 2 && payload[0] === TRACE_PACKET_MARKER[0] && payload[1] === TRACE_PACKET_MARKER[1];
	}

	public parseMapPacket(payload: Buffer): Q10MapPacket {
		if (!Q10MapParser.isMapPacket(payload) || payload.length < 29) {
			throw new Error('Q10 map packet: invalid header');
		}

		const mapId = payload.readUInt32BE(2);
		const width = payload.readUInt16BE(7);
		if (width <= 0) {
			throw new Error('Q10 map packet: invalid width');
		}
		const height = payload.readUInt16BE(9);
		const originX = payload.readInt16BE(11);
		const originY = payload.readInt16BE(13);
		const resolution = payload.readUInt16BE(15);
		const compressedLength = payload.readUInt16BE(27);
		if (compressedLength <= 0 || 29 + compressedLength > payload.length) {
			throw new Error('Q10 map packet: invalid compressed length');
		}

		const decoded = decompressLZ4Block(payload.subarray(29, 29 + compressedLength));
		const area = width * height;
		if (area <= 0 || area > decoded.length) {
			throw new Error('Q10 map packet: invalid grid area');
		}

		const grid = decoded.subarray(0, area);
		const roomData = decoded.subarray(area);
		if (roomData.length < 2 || roomData[0] !== 1) {
			throw new Error('Q10 map packet: invalid room data header');
		}

		const roomCount = roomData[1];
		if (roomData.length < 2 + roomCount * ROOM_RECORD_SIZE) {
			throw new Error('Q10 map packet: truncated room records');
		}

		const rooms: Q10RoomInfo[] = [];
		for (let i = 0; i < roomCount; i++) {
			const record = roomData.subarray(2 + i * ROOM_RECORD_SIZE, 2 + i * ROOM_RECORD_SIZE + ROOM_RECORD_SIZE);
			const roomId = record.readUInt16BE(0);
			const nameLength = record[ROOM_NAME_LENGTH_OFFSET];
			const roomName = record.subarray(ROOM_NAME_OFFSET, ROOM_NAME_OFFSET + nameLength).toString('utf8');
			rooms.push({
				roomId,
				roomName,
				pixelValue: (roomId * ROOM_PIXEL_MULTIPLIER) & ROOM_PIXEL_MASK,
			});
		}

		const calibration: Q10GridCalibration = { originX, originY, resolution };

		return {
			mapId,
			width,
			height,
			grid: Buffer.from(grid),
			rooms,
			calibration,
		};
	}

	public parseTracePacket(payload: Buffer): Q10RobotPosition {
		if (!Q10MapParser.isTracePacket(payload) || payload.length < 18 || (payload.length - 14) % 4 !== 0) {
			throw new Error('Q10 trace packet: invalid payload');
		}

		const x = payload.readInt16BE(payload.length - 4);
		const y = payload.readInt16BE(payload.length - 2);
		return { x, y };
	}

	public resolveRoomIdAtPoint(packet: Q10MapPacket, position: Q10RobotPosition): number | undefined {
		const { px, py } = q10PositionToGridPixel(position, packet.calibration);
		if (px < 0 || px >= packet.width || py < 0 || py >= packet.height) {
			return undefined;
		}
		const value = packet.grid[py * packet.width + px];
		const room = packet.rooms.find((r) => r.pixelValue === value);
		return room?.roomId;
	}
}
