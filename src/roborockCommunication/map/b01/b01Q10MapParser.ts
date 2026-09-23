import { decompressLz4Block } from './lz4BlockDecompressor.js';
import { B01MapInfo, B01RoomInfo } from './types.js';

const ROOM_RECORD_SIZE = 47;
const HEADER_SIZE = 29;

export function parseQ10MapPacket(payload: Buffer): B01MapInfo {
	if (payload.length < HEADER_SIZE || payload[0] !== 0x01 || payload[1] !== 0x01) {
		throw new Error('Q10 map packet: invalid header or unrecognized marker bytes');
	}

	const mapId = payload.readUInt32BE(2);
	const width = payload.readUInt16BE(7);
	const height = payload.readUInt16BE(9);
	const compressedLength = payload.readUInt16BE(27);

	if (width <= 0 || height <= 0 || HEADER_SIZE + compressedLength > payload.length) {
		throw new Error('Q10 map packet: invalid width/height or compressed length out of bounds');
	}

	const decoded = decompressLz4Block(payload.subarray(HEADER_SIZE, HEADER_SIZE + compressedLength));

	const gridSize = width * height;
	const roomSection = decoded.subarray(gridSize);
	if (roomSection.length < 2 || roomSection[0] !== 0x01) {
		throw new Error('Q10 map packet: unrecognized room-section layout after grid split');
	}

	const roomCount = roomSection[1];
	const rooms: B01RoomInfo[] = [];
	for (let i = 0; i < roomCount; i++) {
		const recordStart = 2 + i * ROOM_RECORD_SIZE;
		const recordEnd = recordStart + ROOM_RECORD_SIZE;
		if (recordEnd > roomSection.length) {
			break;
		}
		const record = roomSection.subarray(recordStart, recordEnd);
		const roomId = record.readUInt16BE(0);
		const nameLength = Math.min(record[26], record.length - 27);
		const roomName = record.subarray(27, 27 + nameLength).toString('utf8');
		rooms.push({ roomId, roomName });
	}

	return { rooms, mapId, currentPose: undefined, roomMatrix: undefined };
}
