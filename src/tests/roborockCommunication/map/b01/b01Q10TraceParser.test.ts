import { describe, expect, it } from 'vitest';

import { parseQ10TracePacket, parseTracePacket } from '../../../../roborockCommunication/map/b01/b01Q10TraceParser.js';

describe('b01Q10TraceParser', () => {
	describe('parseTracePacket — header validation', () => {
		it('should throw error when buffer length is less than header length (14 bytes)', () => {
			const shortBuffer = Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
			expect(() => parseTracePacket(shortBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should throw error when first byte is not 0x02', () => {
			const invalidMarkerBuffer = Buffer.alloc(14);
			invalidMarkerBuffer[0] = 0x01;
			invalidMarkerBuffer[1] = 0x01;
			expect(() => parseTracePacket(invalidMarkerBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should throw error when second byte is not 0x01', () => {
			const invalidMarkerBuffer = Buffer.alloc(14);
			invalidMarkerBuffer[0] = 0x02;
			invalidMarkerBuffer[1] = 0x02;
			expect(() => parseTracePacket(invalidMarkerBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should accept buffer with exactly 14 bytes (header only, no points)', () => {
			const headerOnlyBuffer = Buffer.alloc(14);
			headerOnlyBuffer[0] = 0x02;
			headerOnlyBuffer[1] = 0x01;
			const result = parseTracePacket(headerOnlyBuffer);
			expect(result.points).toEqual([]);
		});
	});

	describe('parseTracePacket — session counter extraction', () => {
		it('should extract session counter from byte offset 3', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 42; // session counter
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(42);
		});

		it('should handle session counter value 0', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 0;
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(0);
		});

		it('should handle maximum session counter value (255)', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 255;
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(255);
		});
	});

	describe('parseTracePacket — point pair extraction', () => {
		it('should extract single point pair (x, y) as big-endian int16 values', () => {
			const buffer = Buffer.alloc(18); // header (14) + one point (4)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Write first point at offset 14: x=100, y=200 (big-endian int16)
			buffer.writeInt16BE(100, 14);
			buffer.writeInt16BE(200, 16);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(1);
			expect(result.points[0]).toEqual({ x: 100, y: 200 });
		});

		it('should extract multiple point pairs in sequence', () => {
			const buffer = Buffer.alloc(22); // header (14) + two points (8)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// First point: x=10, y=20
			buffer.writeInt16BE(10, 14);
			buffer.writeInt16BE(20, 16);
			// Second point: x=30, y=40
			buffer.writeInt16BE(30, 18);
			buffer.writeInt16BE(40, 20);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(2);
			expect(result.points[0]).toEqual({ x: 10, y: 20 });
			expect(result.points[1]).toEqual({ x: 30, y: 40 });
		});

		it('should handle negative coordinates (signed int16)', () => {
			const buffer = Buffer.alloc(18);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Negative coordinates: x=-100, y=-200
			buffer.writeInt16BE(-100, 14);
			buffer.writeInt16BE(-200, 16);

			const result = parseTracePacket(buffer);
			expect(result.points[0]).toEqual({ x: -100, y: -200 });
		});

		it('should handle boundary int16 values (min/max)', () => {
			const buffer = Buffer.alloc(18);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Min int16: -32768, Max int16: 32767
			buffer.writeInt16BE(-32768, 14);
			buffer.writeInt16BE(32767, 16);

			const result = parseTracePacket(buffer);
			expect(result.points[0]).toEqual({ x: -32768, y: 32767 });
		});
	});

	describe('parseTracePacket — heading field extraction', () => {
		it('should extract heading from byte offset 10 as signed int16', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(90, 10); // heading at offset 10
			const result = parseTracePacket(buffer);
			expect(result.heading).toBe(90);
		});

		it('should handle negative heading values', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(-45, 10);
			const result = parseTracePacket(buffer);
			expect(result.heading).toBe(-45);
		});

		it('should handle boundary heading values', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(32767, 10); // max int16
			const result = parseTracePacket(buffer);
			expect(result.heading).toBe(32767);
		});
	});

	describe('parseTracePacket — body length validation', () => {
		it('should throw error when body length is not a multiple of 4', () => {
			// Header (14) + 5 bytes = invalid (not divisible by 4)
			const buffer = Buffer.alloc(19);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 1 byte (after header)', () => {
			const buffer = Buffer.alloc(15);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 2 bytes (after header)', () => {
			const buffer = Buffer.alloc(16);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 3 bytes (after header)', () => {
			const buffer = Buffer.alloc(17);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});
	});

	describe('parseQ10TracePacket', () => {
		it('should return B01MapInfo with rooms=[], mapId=undefined, roomMatrix=undefined', () => {
			const buffer = Buffer.alloc(18);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(90, 10); // heading
			buffer.writeInt16BE(100, 14); // first point x
			buffer.writeInt16BE(200, 16); // first point y

			const result = parseQ10TracePacket(buffer);
			expect(result.rooms).toEqual([]);
			expect(result.mapId).toBeUndefined();
			expect(result.roomMatrix).toBeUndefined();
		});

		it('should set currentPose to last point with heading (phi) when points exist', () => {
			const buffer = Buffer.alloc(22); // header (14) + 2 points (8)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(45, 10); // heading
			buffer.writeInt16BE(10, 14);
			buffer.writeInt16BE(20, 16);
			buffer.writeInt16BE(30, 18);
			buffer.writeInt16BE(40, 20);

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose).toEqual({ x: 30, y: 40, phi: 45 });
		});

		it('should set currentPose to undefined when no points (empty body)', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(60, 10); // heading (ignored when no points)

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose).toBeUndefined();
		});

		it('should include heading in currentPose phi field', () => {
			const buffer = Buffer.alloc(18);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(90, 10); // heading
			buffer.writeInt16BE(100, 14); // point x
			buffer.writeInt16BE(200, 16); // point y

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose?.phi).toBe(90);
		});

		it('should handle negative heading values in currentPose', () => {
			const buffer = Buffer.alloc(18);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(-45, 10); // negative heading
			buffer.writeInt16BE(100, 14);
			buffer.writeInt16BE(200, 16);

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose?.phi).toBe(-45);
		});

		it('should throw when payload has invalid marker', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x01;
			buffer[1] = 0x01;
			expect(() => parseQ10TracePacket(buffer)).toThrow(/Q10 trace packet: invalid header/);
		});

		it('should throw when payload body is not 4-byte aligned', () => {
			const buffer = Buffer.alloc(19);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseQ10TracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});
	});
});
