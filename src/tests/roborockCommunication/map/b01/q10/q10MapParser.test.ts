import { beforeEach, describe, expect, it } from 'vitest';

import { Q10MapParser, q10PositionToGridPixel } from '../../../../../roborockCommunication/map/b01/q10/q10MapParser.js';
import type { Q10MapPacket } from '../../../../../roborockCommunication/map/b01/q10/types.js';
import { asPartial } from '../../../../helpers/testUtils.js';

/**
 * Helper to create a minimal all-literal LZ4 block from raw bytes.
 * LZ4 all-literal block: [token, ...bytes] where token = (bytes.length << 4)
 */
function makeLZ4LiteralBlock(data: Buffer): Buffer {
	if (data.length > 14) {
		// For length > 14, need length extension
		const token = 0xf0; // literalLength nibble = 0x0F
		const extra = data.length - 15;
		let lengthExt = Buffer.alloc(0);
		let remaining = extra;
		while (remaining >= 255) {
			lengthExt = Buffer.concat([lengthExt, Buffer.from([0xff])]);
			remaining -= 255;
		}
		lengthExt = Buffer.concat([lengthExt, Buffer.from([remaining])]);
		return Buffer.concat([Buffer.from([token]), lengthExt, data]);
	}
	const token = data.length << 4;
	return Buffer.concat([Buffer.from([token]), data]);
}

describe('Q10MapParser', () => {
	let parser: Q10MapParser;

	beforeEach(() => {
		parser = new Q10MapParser();
	});

	describe('isMapPacket', () => {
		it('should return true for valid map packet marker', () => {
			const buffer = Buffer.from([0x01, 0x01, 0x00, 0x00, 0x00, 0x00]);
			expect(Q10MapParser.isMapPacket(buffer)).toBe(true);
		});

		it('should return false for non-map marker', () => {
			const buffer = Buffer.from([0x02, 0x01, 0x00, 0x00]);
			expect(Q10MapParser.isMapPacket(buffer)).toBe(false);
		});

		it('should return false for single-byte buffer', () => {
			const buffer = Buffer.from([0x01]);
			expect(Q10MapParser.isMapPacket(buffer)).toBe(false);
		});

		it('should return false for empty buffer', () => {
			const buffer = Buffer.alloc(0);
			expect(Q10MapParser.isMapPacket(buffer)).toBe(false);
		});
	});

	describe('isTracePacket', () => {
		it('should return true for valid trace packet marker', () => {
			const buffer = Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00, 0x00]);
			expect(Q10MapParser.isTracePacket(buffer)).toBe(true);
		});

		it('should return false for non-trace marker', () => {
			const buffer = Buffer.from([0x01, 0x01, 0x00, 0x00]);
			expect(Q10MapParser.isTracePacket(buffer)).toBe(false);
		});

		it('should return false for single-byte buffer', () => {
			const buffer = Buffer.from([0x02]);
			expect(Q10MapParser.isTracePacket(buffer)).toBe(false);
		});

		it('should return false for empty buffer', () => {
			const buffer = Buffer.alloc(0);
			expect(Q10MapParser.isTracePacket(buffer)).toBe(false);
		});
	});

	describe('parseMapPacket', () => {
		it('should parse a valid map packet with one room', () => {
			// Build a minimal valid map packet
			const payload = Buffer.alloc(100);
			payload[0] = 0x01; // marker
			payload[1] = 0x01;
			payload.writeUInt32BE(0x12345678, 2); // mapId
			payload.writeUInt16BE(10, 7); // width
			payload.writeUInt16BE(5, 9); // height
			payload.writeInt16BE(100, 11); // originX
			payload.writeInt16BE(200, 13); // originY
			payload.writeUInt16BE(5, 15); // resolution
			// payload.writeUInt16BE(compressedLength, 27); // set below

			// Create grid data (10*5=50 bytes) + room data
			const gridData = Buffer.alloc(50, 0x28); // grid cell value = 40 (0x28) = (10*4)&0xFF
			const roomRecord = Buffer.alloc(47);
			roomRecord.writeUInt16BE(10, 0); // roomId
			roomRecord[26] = 7; // nameLength = 7
			roomRecord.write('Kitchen', 27, 'utf8');

			const roomDataHeader = Buffer.from([0x01, 0x01]); // marker + count
			const uncompressedData = Buffer.concat([gridData, roomDataHeader, roomRecord]);

			// Compress using LZ4 literal block
			const compressedData = makeLZ4LiteralBlock(uncompressedData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			const result = parser.parseMapPacket(fullPayload);

			expect(result.mapId).toBe(0x12345678);
			expect(result.width).toBe(10);
			expect(result.height).toBe(5);
			expect(result.grid).toHaveLength(50);
			expect(result.calibration.originX).toBe(100);
			expect(result.calibration.originY).toBe(200);
			expect(result.calibration.resolution).toBe(5);
			expect(result.rooms).toHaveLength(1);
			expect(result.rooms[0].roomId).toBe(10);
			expect(result.rooms[0].roomName).toBe('Kitchen');
			expect(result.rooms[0].pixelValue).toBe((10 * 4) & 0xff); // 40
		});

		it('should throw "Q10 map packet: invalid header" for wrong marker', () => {
			const payload = Buffer.alloc(30);
			payload[0] = 0x02; // wrong marker
			payload[1] = 0x01;

			expect(() => parser.parseMapPacket(payload)).toThrow('Q10 map packet: invalid header');
		});

		it('should throw "Q10 map packet: invalid header" when length < 29', () => {
			const payload = Buffer.alloc(28);
			payload[0] = 0x01;
			payload[1] = 0x01;

			expect(() => parser.parseMapPacket(payload)).toThrow('Q10 map packet: invalid header');
		});

		it('should throw "Q10 map packet: invalid width" when width <= 0', () => {
			const payload = Buffer.alloc(30);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(0, 7); // width = 0

			expect(() => parser.parseMapPacket(payload)).toThrow('Q10 map packet: invalid width');
		});

		it('should throw "Q10 map packet: invalid compressed length" when compressedLength <= 0', () => {
			const payload = Buffer.alloc(30);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(10, 7); // width
			payload.writeUInt16BE(10, 9); // height
			payload.writeUInt16BE(0, 27); // compressedLength = 0

			expect(() => parser.parseMapPacket(payload)).toThrow('Q10 map packet: invalid compressed length');
		});

		it('should throw "Q10 map packet: invalid compressed length" when layout end past buffer length', () => {
			const payload = Buffer.alloc(40);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(10, 7); // width
			payload.writeUInt16BE(10, 9); // height
			payload.writeUInt16BE(1000, 27); // compressedLength = 1000 (too large)

			expect(() => parser.parseMapPacket(payload)).toThrow('Q10 map packet: invalid compressed length');
		});

		it('should throw "Q10 map packet: invalid grid area" when area > decoded.length', () => {
			const payload = Buffer.alloc(100);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(100, 7); // width = 100
			payload.writeUInt16BE(100, 9); // height = 100 → area = 10000
			payload.writeInt16BE(100, 11); // originX
			payload.writeInt16BE(200, 13); // originY
			payload.writeUInt16BE(5, 15); // resolution

			// Create small compressed data (less than 10000)
			const smallData = Buffer.alloc(50);
			const compressedData = makeLZ4LiteralBlock(smallData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			expect(() => parser.parseMapPacket(fullPayload)).toThrow('Q10 map packet: invalid grid area');
		});

		it('should throw "Q10 map packet: invalid room data header" when roomData[0] !== 1', () => {
			const payload = Buffer.alloc(100);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(10, 7); // width
			payload.writeUInt16BE(5, 9); // height
			payload.writeInt16BE(100, 11);
			payload.writeInt16BE(200, 13);
			payload.writeUInt16BE(5, 15);

			const gridData = Buffer.alloc(50, 0x28);
			const invalidRoomHeader = Buffer.from([0x02]); // wrong marker
			const uncompressedData = Buffer.concat([gridData, invalidRoomHeader]);
			const compressedData = makeLZ4LiteralBlock(uncompressedData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			expect(() => parser.parseMapPacket(fullPayload)).toThrow('Q10 map packet: invalid room data header');
		});

		it('should throw "Q10 map packet: truncated room records" when not enough bytes for room count', () => {
			const payload = Buffer.alloc(100);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(10, 7); // width
			payload.writeUInt16BE(5, 9); // height
			payload.writeInt16BE(100, 11);
			payload.writeInt16BE(200, 13);
			payload.writeUInt16BE(5, 15);

			const gridData = Buffer.alloc(50, 0x28);
			const roomHeader = Buffer.from([0x01, 0x02]); // 2 rooms expected
			const oneRoom = Buffer.alloc(47);
			oneRoom.writeUInt16BE(10, 0);
			const uncompressedData = Buffer.concat([gridData, roomHeader, oneRoom]); // only 1 room, not 2
			const compressedData = makeLZ4LiteralBlock(uncompressedData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			expect(() => parser.parseMapPacket(fullPayload)).toThrow('Q10 map packet: truncated room records');
		});

		it('should decode room name correctly bounded by nameLength', () => {
			const payload = Buffer.alloc(100);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(5, 7); // width
			payload.writeUInt16BE(5, 9); // height
			payload.writeInt16BE(100, 11);
			payload.writeInt16BE(200, 13);
			payload.writeUInt16BE(5, 15);

			const gridData = Buffer.alloc(25, 0x28);
			const roomRecord = Buffer.alloc(47);
			roomRecord.writeUInt16BE(10, 0); // roomId
			// Write 'Kitchen' (7 bytes) but set nameLength=4 to cut it off
			roomRecord[26] = 4; // nameLength = 4
			roomRecord.write('KitchenGARBAGE', 27, 'utf8');
			const roomHeader = Buffer.from([0x01, 0x01]);
			const uncompressedData = Buffer.concat([gridData, roomHeader, roomRecord]);
			const compressedData = makeLZ4LiteralBlock(uncompressedData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			const result = parser.parseMapPacket(fullPayload);
			expect(result.rooms[0].roomName).toBe('Kitc'); // 4 bytes (nameLength=4)
		});

		it('should handle multiple rooms', () => {
			const payload = Buffer.alloc(150);
			payload[0] = 0x01;
			payload[1] = 0x01;
			payload.writeUInt16BE(5, 7); // width
			payload.writeUInt16BE(5, 9); // height
			payload.writeInt16BE(100, 11);
			payload.writeInt16BE(200, 13);
			payload.writeUInt16BE(5, 15);

			const gridData = Buffer.alloc(25, 0x28);
			const roomRecord1 = Buffer.alloc(47);
			roomRecord1.writeUInt16BE(10, 0);
			roomRecord1[26] = 4;
			roomRecord1.write('Room', 27);

			const roomRecord2 = Buffer.alloc(47);
			roomRecord2.writeUInt16BE(20, 0);
			roomRecord2[26] = 5;
			roomRecord2.write('Other', 27);

			const roomHeader = Buffer.from([0x01, 0x02]); // 2 rooms
			const uncompressedData = Buffer.concat([gridData, roomHeader, roomRecord1, roomRecord2]);
			const compressedData = makeLZ4LiteralBlock(uncompressedData);
			payload.writeUInt16BE(compressedData.length, 27);

			const fullPayload = Buffer.concat([payload.subarray(0, 29), compressedData]);

			const result = parser.parseMapPacket(fullPayload);
			expect(result.rooms).toHaveLength(2);
			expect(result.rooms[0].roomId).toBe(10);
			expect(result.rooms[1].roomId).toBe(20);
		});
	});

	describe('parseTracePacket', () => {
		it('should parse valid trace packet from ground-truth hex sample', () => {
			// From requirement.md: 0201 00 0d 0002 0000 0001 0045 0000 00010000 (18 bytes, 1 point)
			// Marker: 0x02, 0x01
			// Then: some fields (0x00, 0x0d, 0x0002, 0x0000, 0x0001, 0x0045, 0x0000)
			// Last 4 bytes: 0x0001, 0x0000 (x=1, y=0)
			const payload = Buffer.from([
				0x02,
				0x01, // marker
				0x00,
				0x0d,
				0x00,
				0x02,
				0x00,
				0x00,
				0x00,
				0x01,
				0x00,
				0x45,
				0x00,
				0x00,
				0x00,
				0x01, // x (last 4 bytes before y)
				0x00,
				0x00, // y
			]);

			const result = parser.parseTracePacket(payload);
			expect(result.x).toBe(1);
			expect(result.y).toBe(0);
		});

		it('should parse only the last x,y pair from multi-point trace packet', () => {
			// Build a trace packet with 2 points (18 + 4 = 22 bytes)
			const header = Buffer.from([0x02, 0x01, 0x00, 0x0d, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01, 0x00, 0x45, 0x00, 0x00]);
			const point1 = Buffer.alloc(4);
			point1.writeInt16BE(-100, 0); // x = -100
			point1.writeInt16BE(200, 2); // y = 200

			const point2 = Buffer.alloc(4);
			point2.writeInt16BE(500, 0); // x = 500
			point2.writeInt16BE(-300, 2); // y = -300

			const payload = Buffer.concat([header, point1, point2]);

			const result = parser.parseTracePacket(payload);
			expect(result.x).toBe(500);
			expect(result.y).toBe(-300);
		});

		it('should throw "Q10 trace packet: invalid payload" for wrong marker', () => {
			const payload = Buffer.from([
				0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
			]);
			expect(() => parser.parseTracePacket(payload)).toThrow('Q10 trace packet: invalid payload');
		});

		it('should throw "Q10 trace packet: invalid payload" when length < 18', () => {
			const payload = Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00, 0x00]);
			expect(() => parser.parseTracePacket(payload)).toThrow('Q10 trace packet: invalid payload');
		});

		it('should throw "Q10 trace packet: invalid payload" when (length - 14) % 4 !== 0', () => {
			// 19 bytes: (19 - 14) % 4 = 5 % 4 = 1 (not 0)
			const payload = Buffer.alloc(19, 0x00);
			payload[0] = 0x02;
			payload[1] = 0x01;
			expect(() => parser.parseTracePacket(payload)).toThrow('Q10 trace packet: invalid payload');
		});
	});

	describe('q10PositionToGridPixel', () => {
		it('should convert ground-truth position to pixel using the empirical formula', () => {
			const calibration = {
				originX: 1378,
				originY: 1300,
				resolution: 5,
			};
			const position = { x: -1348, y: -588 };

			const result = q10PositionToGridPixel(position, calibration);

			expect(result.px).toBe(165);
			expect(result.py).toBe(118);
		});

		it('should prove divisor is hardcoded 50, not resolution * 10', () => {
			const position = { x: -1348, y: -588 };
			const calibrationBase = {
				originX: 1378,
				originY: 1300,
				resolution: 5,
			};

			const result1 = q10PositionToGridPixel(position, calibrationBase);

			// Change resolution and verify result is unchanged (proof that resolution field isn't used)
			const calibrationAlt = { ...calibrationBase, resolution: 10 };
			const result2 = q10PositionToGridPixel(position, calibrationAlt);

			expect(result1).toEqual(result2);
		});

		it('should prove origin scaling affects px/py proportionally', () => {
			const position = { x: -1348, y: -588 };
			const calibration1 = {
				originX: 1378,
				originY: 1300,
				resolution: 5,
			};
			const calibration2 = {
				originX: 2756, // doubled
				originY: 2600, // doubled
				resolution: 5,
			};

			const result1 = q10PositionToGridPixel(position, calibration1);
			const result2 = q10PositionToGridPixel(position, calibration2);

			// Doubling origin should shift px/py by (doubled_origin - origin) / 10 = origin / 10
			const deltaX = result2.px - result1.px;
			const deltaY = result2.py - result1.py;
			expect(deltaX).toBe(Math.round((2756 - 1378) / 10)); // ~138
			expect(deltaY).toBe(Math.round((2600 - 1300) / 10)); // ~130
		});

		it('should prove x-sign is inverted, y-sign is not', () => {
			const calibration = {
				originX: 1000,
				originY: 1000,
				resolution: 5,
			};

			// Positive x and y
			const posPos = q10PositionToGridPixel({ x: 100, y: 100 }, calibration);
			// Negative x and y
			const negNeg = q10PositionToGridPixel({ x: -100, y: -100 }, calibration);
			// Positive x, negative y
			const posNeg = q10PositionToGridPixel({ x: 100, y: -100 }, calibration);

			// With x sign inverted: +x → lower px, -x → higher px (opposite to y behavior)
			expect(posPos.px).toBeLessThan(negNeg.px); // positive x → lower px (inverted)
			expect(posPos.py).toBeGreaterThan(negNeg.py); // positive y → higher py (not inverted)

			// Mixed case proves independence
			expect(posNeg.px).toBeLessThan(calibration.originX / 10); // positive x makes px < origin (98 < 100)
			expect(posNeg.py).toBeLessThan(calibration.originY / 10); // negative y makes py < origin (98 < 100)
		});
	});

	describe('resolveRoomIdAtPoint', () => {
		it('should resolve roomId from ground-truth packet at calibrated position', () => {
			// Build a minimal map packet with the ground-truth calibration
			const width = 300;
			const height = 200;
			const grid = Buffer.alloc(width * height, 0x00);
			// Place pixel value 40 at position (165, 118)
			grid[118 * width + 165] = 40; // 0x28 = (10*4)&0xFF

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: {
					originX: 1378,
					originY: 1300,
					resolution: 5,
				},
				rooms: [
					{
						roomId: 10,
						roomName: 'Séjour',
						pixelValue: 40,
					},
				],
			});

			const position = { x: -1348, y: -588 };
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBe(10);
		});

		it('should return undefined when grid value has no matching room', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x00);
			// Grid value 100 has no matching room pixelValue
			grid[50 * width + 50] = 100;

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 500, originY: 500, resolution: 5 },
				rooms: [
					{ roomId: 1, roomName: 'Room1', pixelValue: 50 },
					{ roomId: 2, roomName: 'Room2', pixelValue: 75 },
				],
			});

			const position = { x: 0, y: 0 };
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBeUndefined();
		});

		it('should return undefined when position is out of bounds (px < 0)', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x28);

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 0, originY: 0, resolution: 5 }, // origin at 0
				rooms: [{ roomId: 10, roomName: 'Room', pixelValue: 0x28 }],
			});

			// Position that converts to negative px
			const position = { x: 1000, y: 0 }; // px = -1000 / 50 + 0 = -20
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBeUndefined();
		});

		it('should return undefined when position is out of bounds (px >= width)', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x28);

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 1000, originY: 1000, resolution: 5 },
				rooms: [{ roomId: 10, roomName: 'Room', pixelValue: 0x28 }],
			});

			// Position that converts to px >= width
			const position = { x: -10000, y: 0 }; // px = -(-10000) / 50 + 100 = 300
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBeUndefined();
		});

		it('should return undefined when position is out of bounds (py < 0)', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x28);

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 1000, originY: 0, resolution: 5 },
				rooms: [{ roomId: 10, roomName: 'Room', pixelValue: 0x28 }],
			});

			// Position that converts to negative py
			const position = { x: 0, y: -1000 }; // py = 0 + (-1000) / 50 = -20
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBeUndefined();
		});

		it('should return undefined when position is out of bounds (py >= height)', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x28);

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 1000, originY: 500, resolution: 5 },
				rooms: [{ roomId: 10, roomName: 'Room', pixelValue: 0x28 }],
			});

			// Position that converts to py >= height
			const position = { x: 0, y: 10000 }; // py = 50 + 10000 / 50 = 250
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBeUndefined();
		});

		it('should return correct roomId when multiple rooms exist', () => {
			const width = 100;
			const height = 100;
			const grid = Buffer.alloc(width * height, 0x00);
			// Place room2's pixel value at (50, 50)
			grid[50 * width + 50] = 80; // (20*4)&0xFF = 80

			const packet = asPartial<Q10MapPacket>({
				mapId: 100,
				width,
				height,
				grid,
				calibration: { originX: 500, originY: 500, resolution: 5 },
				rooms: [
					{ roomId: 10, roomName: 'Room1', pixelValue: 40 },
					{ roomId: 20, roomName: 'Room2', pixelValue: 80 },
				],
			});

			const position = { x: 0, y: 0 }; // Converts to px≈100, py≈100 (but depends on rounding)
			const result = parser.resolveRoomIdAtPoint(packet, position);

			expect(result).toBe(20);
		});
	});
});
