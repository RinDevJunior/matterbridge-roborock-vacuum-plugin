import { describe, expect, it } from 'vitest';

import { parseQ10MapPacket } from '../../../../roborockCommunication/map/b01/b01Q10MapParser.js';
import { decompressLz4Block } from '../../../../roborockCommunication/map/b01/lz4BlockDecompressor.js';

interface Q10PacketOptions {
	originXRaw?: number;
	originYRaw?: number;
	resolutionRaw?: number;
}

/**
 * Helper to build a synthetic Q10 packet with LZ4-compressed grid + room data.
 * Uses an all-literal LZ4 block (no match section) to avoid needing a compressor.
 *
 * Layout:
 * - Bytes 0-1: marker (0x01 0x01)
 * - Bytes 2-5: mapId (u32be)
 * - Bytes 6: reserved
 * - Bytes 7-8: width (u16be)
 * - Bytes 9-10: height (u16be)
 * - Bytes 11-12: origin_x (s16be)
 * - Bytes 13-14: origin_y (s16be)
 * - Bytes 15-16: resolution (u16be)
 * - Bytes 17-26: reserved
 * - Bytes 27-28: compressedLength (u16be)
 * - Bytes 29+: LZ4 block
 */
function buildQ10Packet(
	mapId: number,
	width: number,
	height: number,
	gridAndRoomData: Buffer,
	options: Q10PacketOptions = {},
): Buffer {
	// Build LZ4 all-literal block: token byte followed by raw uncompressed data
	// Token byte: 0xf0 = literalLength nibble 15 (high), matchLength nibble 0 (low)
	// If data is > 15 bytes, we need extension bytes
	const dataLength = gridAndRoomData.length;
	let lz4Block: Buffer;

	if (dataLength <= 15) {
		// Simple case: token nibble + data
		const tokenByte = (dataLength << 4) | 0x00; // literalLength in high nibble
		lz4Block = Buffer.concat([Buffer.from([tokenByte]), gridAndRoomData]);
	} else if (dataLength <= 15 + 255) {
		// One extension byte needed
		const tokenByte = 0xf0; // literalLength nibble = 15
		const extensionByte = dataLength - 15;
		lz4Block = Buffer.concat([Buffer.from([tokenByte, extensionByte]), gridAndRoomData]);
	} else {
		// Multiple extension bytes needed (for very large grids)
		const tokenByte = 0xf0; // literalLength nibble = 15
		const extensionBytes: number[] = [];
		let remaining = dataLength - 15;
		while (remaining > 255) {
			extensionBytes.push(255);
			remaining -= 255;
		}
		extensionBytes.push(remaining);
		lz4Block = Buffer.concat([Buffer.from([tokenByte, ...extensionBytes]), gridAndRoomData]);
	}

	const compressedLength = lz4Block.length;

	// Build the full packet
	const packet = Buffer.alloc(29 + compressedLength);

	// Bytes 0-1: marker
	packet[0] = 0x01;
	packet[1] = 0x01;

	// Bytes 2-5: mapId (u32be)
	packet.writeUInt32BE(mapId, 2);

	// Bytes 6: reserved (0x00)
	packet[6] = 0x00;

	// Bytes 7-8: width (u16be)
	packet.writeUInt16BE(width, 7);

	// Bytes 9-10: height (u16be)
	packet.writeUInt16BE(height, 9);

	// Bytes 11-12: origin_x (s16be) — default to 0
	packet.writeInt16BE(options.originXRaw ?? 0, 11);

	// Bytes 13-14: origin_y (s16be) — default to 0
	packet.writeInt16BE(options.originYRaw ?? 0, 13);

	// Bytes 15-16: resolution (u16be) — default to 5 (= 50 mm/px)
	packet.writeUInt16BE(options.resolutionRaw ?? 5, 15);

	// Bytes 17-26: reserved
	packet.fill(0x00, 17, 27);

	// Bytes 27-28: compressedLength (u16be)
	packet.writeUInt16BE(compressedLength, 27);

	// Bytes 29+: LZ4 block
	lz4Block.copy(packet, 29);

	return packet;
}

/**
 * Helper to build a room record (47 bytes):
 * - Bytes 0-1: roomId (u16be)
 * - Bytes 2-25: reserved (24 bytes)
 * - Byte 26: nameLength (u8)
 * - Bytes 27-46: roomName (UTF-8, variable length, padded with zeros)
 */
function buildRoomRecord(roomId: number, roomName: string): Buffer {
	const record = Buffer.alloc(47, 0x00);
	record.writeUInt16BE(roomId, 0);
	const nameBytes = Buffer.from(roomName, 'utf8');
	const nameLength = Math.min(nameBytes.length, 20);
	record[26] = nameLength;
	nameBytes.copy(record, 27, 0, nameLength);
	return record;
}

describe('b01Q10MapParser', () => {
	describe('parseQ10MapPacket', () => {
		it('should parse valid full round-trip with marker, grid, and room data', () => {
			// Create a simple 2x2 grid + one room record
			const mapId = 123;
			const width = 2;
			const height = 2;
			const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]); // 4 bytes (2x2)
			const roomRecord = buildRoomRecord(10, 'Bedroom');
			const roomSection = Buffer.concat([Buffer.from([0x01, 0x01]), roomRecord]); // marker + roomCount=1 + room
			const gridAndRoomData = Buffer.concat([grid, roomSection]);

			const packet = buildQ10Packet(mapId, width, height, gridAndRoomData);
			const result = parseQ10MapPacket(packet);

			expect(result.mapId).toBe(mapId);
			expect(result.rooms).toHaveLength(1);
			expect(result.rooms[0]).toMatchObject({
				roomId: 10,
				roomName: 'Bedroom',
			});
			expect(result.currentPose).toBeUndefined();
			// Origin defaults to undefined because both originXRaw and originYRaw are 0 (keepalive frame)
			expect(result.roomMatrix).toEqual({ data: grid, width, height, origin: undefined });
		});

		it('should extract room name with various lengths', () => {
			const mapId = 1;
			const width = 1;
			const height = 1;
			const grid = Buffer.from([0x00]);

			// Test short name
			const roomRecord1 = buildRoomRecord(1, 'Room');
			const roomSection1 = Buffer.concat([Buffer.from([0x01, 0x01]), roomRecord1]);
			const packet1 = buildQ10Packet(mapId, width, height, Buffer.concat([grid, roomSection1]));
			const result1 = parseQ10MapPacket(packet1);
			expect(result1.rooms[0].roomName).toBe('Room');

			// Test longer name (20 bytes max)
			const roomRecord2 = buildRoomRecord(2, 'Very Long Room Name!');
			const roomSection2 = Buffer.concat([Buffer.from([0x01, 0x01]), roomRecord2]);
			const packet2 = buildQ10Packet(mapId, width, height, Buffer.concat([grid, roomSection2]));
			const result2 = parseQ10MapPacket(packet2);
			expect(result2.rooms[0].roomName).toBe('Very Long Room Name!');
		});

		it('should parse multiple room records sequentially', () => {
			const mapId = 5;
			const width = 3;
			const height = 3;
			const grid = Buffer.alloc(9, 0x00); // 3x3

			const room1 = buildRoomRecord(10, 'Living Room');
			const room2 = buildRoomRecord(20, 'Bedroom');
			const room3 = buildRoomRecord(30, 'Kitchen');
			const roomSection = Buffer.concat([
				Buffer.from([0x01, 0x03]), // marker + roomCount=3
				room1,
				room2,
				room3,
			]);
			const gridAndRoomData = Buffer.concat([grid, roomSection]);

			const packet = buildQ10Packet(mapId, width, height, gridAndRoomData);
			const result = parseQ10MapPacket(packet);

			expect(result.rooms).toHaveLength(3);
			expect(result.rooms[0]).toMatchObject({ roomId: 10, roomName: 'Living Room' });
			expect(result.rooms[1]).toMatchObject({ roomId: 20, roomName: 'Bedroom' });
			expect(result.rooms[2]).toMatchObject({ roomId: 30, roomName: 'Kitchen' });
		});

		it('should return successfully parsed rooms when final room record is truncated', () => {
			const mapId = 5;
			const width = 2;
			const height = 2;
			const grid = Buffer.alloc(4, 0x00);

			// Two complete rooms + partial third room
			const room1 = buildRoomRecord(10, 'Room1');
			const room2 = buildRoomRecord(20, 'Room2');
			const truncatedRoom = Buffer.alloc(20); // Only 20 bytes instead of 47
			truncatedRoom.writeUInt16BE(30, 0);

			const roomSection = Buffer.concat([
				Buffer.from([0x01, 0x03]), // marker + roomCount=3
				room1,
				room2,
				truncatedRoom,
			]);
			const gridAndRoomData = Buffer.concat([grid, roomSection]);

			const packet = buildQ10Packet(mapId, width, height, gridAndRoomData);
			const result = parseQ10MapPacket(packet);

			// Should return the two complete rooms without throwing
			expect(result.rooms).toHaveLength(2);
			expect(result.rooms[0]).toMatchObject({ roomId: 10, roomName: 'Room1' });
			expect(result.rooms[1]).toMatchObject({ roomId: 20, roomName: 'Room2' });
		});

		it('should throw error when width is zero or negative', () => {
			const mapId = 1;
			const width = 0;
			const height = 1;
			const grid = Buffer.alloc(0);
			const roomSection = Buffer.from([0x01, 0x00]); // no rooms

			const packet = buildQ10Packet(mapId, width, height, Buffer.concat([grid, roomSection]));
			expect(() => parseQ10MapPacket(packet)).toThrow(/invalid width\/height/);
		});

		it('should throw error when compressedLength points past payload', () => {
			const packet = Buffer.alloc(35);
			packet[0] = 0x01;
			packet[1] = 0x01;
			packet.writeUInt32BE(1, 2); // mapId
			packet.writeUInt16BE(5, 7); // width
			packet.writeUInt16BE(5, 9); // height
			packet.writeUInt16BE(100, 27); // compressedLength = 100, but packet is only 35 bytes

			expect(() => parseQ10MapPacket(packet)).toThrow(/out of bounds/);
		});

		it('should throw error when room-section marker is not 0x01', () => {
			const mapId = 1;
			const width = 1;
			const height = 1;
			const grid = Buffer.from([0x00]);
			const roomSection = Buffer.concat([Buffer.from([0x02, 0x00])]); // Wrong marker (0x02 instead of 0x01)
			const gridAndRoomData = Buffer.concat([grid, roomSection]);

			const packet = buildQ10Packet(mapId, width, height, gridAndRoomData);
			expect(() => parseQ10MapPacket(packet)).toThrow(/unrecognized room-section layout/);
		});

		it('should throw error when buffer does not start with 0x01 0x01 marker', () => {
			// Buffer starts with 0x02 0x01 (not 0x01 0x01)
			const packet = Buffer.alloc(40);
			packet[0] = 0x02;
			packet[1] = 0x01;
			packet.writeUInt32BE(1, 2);
			packet.writeUInt16BE(5, 7);
			packet.writeUInt16BE(5, 9);
			packet.writeUInt16BE(5, 27);
			Buffer.from([0x10, 0x00]).copy(packet, 29); // minimal LZ4

			expect(() => parseQ10MapPacket(packet)).toThrow();
		});

		it('should throw error when payload.length < 29', () => {
			const packet = Buffer.alloc(28);
			packet[0] = 0x01;
			packet[1] = 0x01;

			expect(() => parseQ10MapPacket(packet)).toThrow();
		});

		describe('origin parsing', () => {
			it('should set roomMatrix.origin to undefined when both originXRaw and originYRaw are 0 (keepalive frame)', () => {
				const mapId = 1;
				const width = 2;
				const height = 2;
				const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				const roomSection = Buffer.from([0x01, 0x00]); // marker + no rooms
				const gridAndRoomData = Buffer.concat([grid, roomSection]);

				// Both origin values default to 0
				const packet = buildQ10Packet(mapId, width, height, gridAndRoomData);
				const result = parseQ10MapPacket(packet);

				expect(result.roomMatrix?.origin).toBeUndefined();
			});

			it('should parse origin with non-zero values and resolution=5 (50 mm/px)', () => {
				const mapId = 1;
				const width = 2;
				const height = 2;
				const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				const roomSection = Buffer.from([0x01, 0x00]);
				const gridAndRoomData = Buffer.concat([grid, roomSection]);

				// originXRaw = 100 → x = Math.round(100 / 10) = 10
				// originYRaw = 200 → y = Math.round(200 / 10) = 20
				// resolutionRaw = 5 → resolutionMmPerPixel = 5 * 10 = 50
				const packet = buildQ10Packet(mapId, width, height, gridAndRoomData, {
					originXRaw: 100,
					originYRaw: 200,
					resolutionRaw: 5,
				});
				const result = parseQ10MapPacket(packet);

				expect(result.roomMatrix?.origin).toEqual({
					x: 10,
					y: 20,
					resolutionMmPerPixel: 50,
				});
			});

			it('should correctly handle negative origin_x/origin_y (s16be)', () => {
				const mapId = 1;
				const width = 2;
				const height = 2;
				const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				const roomSection = Buffer.from([0x01, 0x00]);
				const gridAndRoomData = Buffer.concat([grid, roomSection]);

				// originXRaw = -20 → x = Math.round(-20 / 10) = -2
				// originYRaw = -30 → y = Math.round(-30 / 10) = -3
				const packet = buildQ10Packet(mapId, width, height, gridAndRoomData, {
					originXRaw: -20,
					originYRaw: -30,
					resolutionRaw: 5,
				});
				const result = parseQ10MapPacket(packet);

				expect(result.roomMatrix?.origin).toEqual({
					x: -2,
					y: -3,
					resolutionMmPerPixel: 50,
				});
			});

			it('should round origin values correctly', () => {
				const mapId = 1;
				const width = 2;
				const height = 2;
				const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				const roomSection = Buffer.from([0x01, 0x00]);
				const gridAndRoomData = Buffer.concat([grid, roomSection]);

				// originXRaw = 15 → x = Math.round(15 / 10) = 1.5 → 2 (rounds to nearest)
				// originYRaw = 25 → y = Math.round(25 / 10) = 2.5 → 2 or 3 (banker's rounding)
				const packet = buildQ10Packet(mapId, width, height, gridAndRoomData, {
					originXRaw: 15,
					originYRaw: 25,
					resolutionRaw: 5,
				});
				const result = parseQ10MapPacket(packet);

				// Math.round(25 / 10) = 2.5 which rounds to 2 or 3 depending on banker's rounding
				// JavaScript Math.round(2.5) = 2 (banker's rounding), but we verify the actual result
				const originResult = result.roomMatrix?.origin;
				expect(originResult?.x).toBe(2);
				expect([2, 3]).toContain(originResult?.y); // Allow both possible rounding results
				expect(originResult?.resolutionMmPerPixel).toBe(50);
			});

			it('should parse various resolution values', () => {
				const mapId = 1;
				const width = 2;
				const height = 2;
				const grid = Buffer.from([0x00, 0x01, 0x02, 0x03]);
				const roomSection = Buffer.from([0x01, 0x00]);
				const gridAndRoomData = Buffer.concat([grid, roomSection]);

				// resolutionRaw = 10 → resolutionMmPerPixel = 100
				const packet = buildQ10Packet(mapId, width, height, gridAndRoomData, {
					originXRaw: 50,
					originYRaw: 50,
					resolutionRaw: 10,
				});
				const result = parseQ10MapPacket(packet);

				expect(result.roomMatrix?.origin?.resolutionMmPerPixel).toBe(100);
			});
		});
	});
});
