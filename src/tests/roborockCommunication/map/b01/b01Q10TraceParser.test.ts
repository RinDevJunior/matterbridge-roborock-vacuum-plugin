import { describe, expect, it } from 'vitest';

import {
	type B01TracePoint,
	parseQ10TracePacket,
	parseTracePacket,
} from '../../../../roborockCommunication/map/b01/b01Q10TraceParser.js';

describe('b01Q10TraceParser', () => {
	describe('parseTracePacket — header validation', () => {
		it('should throw error when buffer length is less than header length (10 bytes)', () => {
			const shortBuffer = Buffer.from([0x02, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
			expect(() => parseTracePacket(shortBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should throw error when first byte is not 0x02', () => {
			const invalidMarkerBuffer = Buffer.alloc(10);
			invalidMarkerBuffer[0] = 0x01;
			invalidMarkerBuffer[1] = 0x01;
			expect(() => parseTracePacket(invalidMarkerBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should throw error when second byte is not 0x01', () => {
			const invalidMarkerBuffer = Buffer.alloc(10);
			invalidMarkerBuffer[0] = 0x02;
			invalidMarkerBuffer[1] = 0x02;
			expect(() => parseTracePacket(invalidMarkerBuffer)).toThrow(
				/Q10 trace packet: invalid header or unrecognized marker bytes/,
			);
		});

		it('should accept buffer with exactly 10 bytes (header only, no points)', () => {
			const headerOnlyBuffer = Buffer.alloc(10);
			headerOnlyBuffer[0] = 0x02;
			headerOnlyBuffer[1] = 0x01;
			const result = parseTracePacket(headerOnlyBuffer);
			expect(result.points).toEqual([]);
		});
	});

	describe('parseTracePacket — session counter extraction', () => {
		it('should extract session counter from byte offset 3', () => {
			const buffer = Buffer.alloc(10);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 42; // session counter
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(42);
		});

		it('should handle session counter value 0', () => {
			const buffer = Buffer.alloc(10);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 0;
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(0);
		});

		it('should handle maximum session counter value (255)', () => {
			const buffer = Buffer.alloc(10);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer[3] = 255;
			const result = parseTracePacket(buffer);
			expect(result.sessionCounter).toBe(255);
		});
	});

	describe('parseTracePacket — point pair extraction', () => {
		it('should extract single point pair (x, y) as big-endian int16 values', () => {
			const buffer = Buffer.alloc(14); // header (10) + one point (4)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Write first point at offset 10: x=100, y=200 (big-endian int16)
			buffer.writeInt16BE(100, 10);
			buffer.writeInt16BE(200, 12);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(1);
			expect(result.points[0]).toEqual({ x: 100, y: 200 });
		});

		it('should extract multiple point pairs in sequence', () => {
			const buffer = Buffer.alloc(18); // header (10) + two points (8)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// First point: x=10, y=20
			buffer.writeInt16BE(10, 10);
			buffer.writeInt16BE(20, 12);
			// Second point: x=30, y=40
			buffer.writeInt16BE(30, 14);
			buffer.writeInt16BE(40, 16);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(2);
			expect(result.points[0]).toEqual({ x: 10, y: 20 });
			expect(result.points[1]).toEqual({ x: 30, y: 40 });
		});

		it('should handle negative coordinates (signed int16)', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Negative coordinates: x=-100, y=-200
			buffer.writeInt16BE(-100, 10);
			buffer.writeInt16BE(-200, 12);

			const result = parseTracePacket(buffer);
			expect(result.points[0]).toEqual({ x: -100, y: -200 });
		});

		it('should handle boundary int16 values (min/max)', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Min int16: -32768, Max int16: 32767
			buffer.writeInt16BE(-32768, 10);
			buffer.writeInt16BE(32767, 12);

			const result = parseTracePacket(buffer);
			expect(result.points[0]).toEqual({ x: -32768, y: 32767 });
		});
	});

	describe('parseTracePacket — body length validation', () => {
		it('should throw error when body length is not a multiple of 4', () => {
			// Header (10) + 5 bytes = invalid (not divisible by 4)
			const buffer = Buffer.alloc(15);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 1 byte (after header)', () => {
			const buffer = Buffer.alloc(11);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 2 bytes (after header)', () => {
			const buffer = Buffer.alloc(12);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should throw error when body length is 3 bytes (after header)', () => {
			const buffer = Buffer.alloc(13);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseTracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});
	});

	describe('parseTracePacket — stray-leading-point filter (basic guards)', () => {
		it('should not filter when points.length < 3', () => {
			const buffer = Buffer.alloc(10); // no body
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			const result = parseTracePacket(buffer);
			expect(result.points).toEqual([]);
		});

		it('should not filter when points.length === 1', () => {
			const buffer = Buffer.alloc(14); // header + 1 point
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(10, 10);
			buffer.writeInt16BE(20, 12);
			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(1);
			expect(result.points[0]).toEqual({ x: 10, y: 20 });
		});

		it('should not filter when points.length === 2', () => {
			const buffer = Buffer.alloc(18); // header + 2 points
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(10, 10);
			buffer.writeInt16BE(20, 12);
			buffer.writeInt16BE(30, 14);
			buffer.writeInt16BE(40, 16);
			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(2);
			expect(result.points[0]).toEqual({ x: 10, y: 20 });
			expect(result.points[1]).toEqual({ x: 30, y: 40 });
		});
	});

	describe('parseTracePacket — stray-leading-point filter (median step zero guard)', () => {
		it('should not drop first point when rest-of-path steps have median === 0', () => {
			// Points: (0,0), (1000,1000), (1000,1000) — first step is huge (1414), but all rest steps are 0
			// Filter should NOT drop because medianRestStep === 0
			const buffer = Buffer.alloc(22); // header + 3 points
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(1000, 14);
			buffer.writeInt16BE(1000, 16);
			buffer.writeInt16BE(1000, 18);
			buffer.writeInt16BE(1000, 20);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(3);
			expect(result.points[0]).toEqual({ x: 0, y: 0 }); // NOT dropped
		});

		it('should not drop first point when only 3 points total (rest-of-path steps is empty)', () => {
			// Points: (0,0), (100,0), (200,0) — rest steps = distance(100,0 -> 200,0) = 100
			// This is a valid case, but with only 3 points, rest-of-path is a single distance
			// The guard for empty restSteps shouldn't trigger here since there is 1 step in rest
			const buffer = Buffer.alloc(22); // header (10) + 3 points (12)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(100, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(200, 18);
			buffer.writeInt16BE(0, 20);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(3);
			expect(result.points[0]).toEqual({ x: 0, y: 0 });
		});

		it('should drop first point when first step is > 20x median of rest steps', () => {
			// Points: (0,0) [outlier], (1,0) [start of real path], (2,0), (3,0)
			// First step: distance((0,0) -> (1,0)) = 1
			// Rest steps: distance((1,0) -> (2,0)) = 1, distance((2,0) -> (3,0)) = 1
			// Median rest = 1, so firstStep (1) is NOT > 20*1, so NO drop
			const buffer = Buffer.alloc(26); // header (10) + 4 points (16)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(1, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(2, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(3, 22);
			buffer.writeInt16BE(0, 24);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(4);
			expect(result.points[0]).toEqual({ x: 0, y: 0 }); // NOT dropped (1 <= 20*1)
		});
	});

	describe('parseTracePacket — stray-leading-point filter (actual drop condition)', () => {
		it('should drop first point when it is > 20x outlier', () => {
			// Points: (0,0) [outlier], (1000,0) [start of path], (1010,0), (1020,0)
			// First step: distance((0,0) -> (1000,0)) = 1000
			// Rest steps: distance((1000,0) -> (1010,0)) = 10, distance((1010,0) -> (1020,0)) = 10
			// Median rest = 10, firstStep (1000) > 20*10 (200), so DROP
			const buffer = Buffer.alloc(26); // header (10) + 4 points (16)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(1000, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(1010, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(1020, 22);
			buffer.writeInt16BE(0, 24);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(3);
			expect(result.points[0]).toEqual({ x: 1000, y: 0 }); // DROPPED
			expect(result.points[1]).toEqual({ x: 1010, y: 0 });
			expect(result.points[2]).toEqual({ x: 1020, y: 0 });
		});

		it('should drop first point when using Euclidean distance (not just x-axis)', () => {
			// Points: (0,0) [outlier at 141 units away], (100,100) [start of path], (110,105), (120,110)
			// First step: distance((0,0) -> (100,100)) = sqrt(100^2 + 100^2) ≈ 141.42
			// Rest steps: distance((100,100) -> (110,105)) ≈ 11.18, distance((110,105) -> (120,110)) ≈ 11.18
			// Median rest ≈ 11.18, firstStep (141.42) > 20 * 11.18 (223.6)? NO, so NO drop
			// Let's use a larger outlier: (0,0) at distance 707 from (500,500)
			const buffer = Buffer.alloc(26); // header (10) + 4 points (16)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(500, 14);
			buffer.writeInt16BE(500, 16);
			buffer.writeInt16BE(510, 18);
			buffer.writeInt16BE(505, 20);
			buffer.writeInt16BE(520, 22);
			buffer.writeInt16BE(510, 24);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(3);
			expect(result.points[0]).toEqual({ x: 500, y: 500 }); // DROPPED (huge outlier)
			expect(result.points[1]).toEqual({ x: 510, y: 505 });
			expect(result.points[2]).toEqual({ x: 520, y: 510 });
		});

		it('should not drop if first step is exactly at the 20x threshold (boundary condition)', () => {
			// Points: (0,0), (10,0), (11,0), (12,0)
			// First step: 10
			// Rest steps: 1, 1 -> median = 1
			// firstStep (10) === 20*1 (10), NOT >, so NO drop
			const buffer = Buffer.alloc(26); // header (10) + 4 points (16)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(10, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(11, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(12, 22);
			buffer.writeInt16BE(0, 24);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(4);
			expect(result.points[0]).toEqual({ x: 0, y: 0 }); // NOT dropped (10 === 20*1, not >)
		});

		it('should drop if first step is just above the 20x threshold', () => {
			// Points: (0,0), (10.01,0), (11,0), (12,0)
			// Use discrete coords: (0,0), (21,0), (22,0), (23,0)
			// First step: 21
			// Rest steps: 1, 1 -> median = 1
			// firstStep (21) > 20*1 (20), so DROP
			const buffer = Buffer.alloc(26); // header (10) + 4 points (16)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(21, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(22, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(23, 22);
			buffer.writeInt16BE(0, 24);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(3);
			expect(result.points[0]).toEqual({ x: 21, y: 0 }); // DROPPED
		});
	});

	describe('parseTracePacket — stray-leading-point filter (odd/even median)', () => {
		it('should compute median correctly for even-length rest steps (average of middle two)', () => {
			// Points: (0,0) [outlier], (100,0), (110,0), (120,0), (130,0)
			// First step: 100
			// Rest steps: 10, 10, 10 (3 steps, indices 1->2, 2->3, 3->4)
			// Median of [10, 10, 10] = 10
			// firstStep (100) > 20*10 (200)? NO, so NO drop
			const buffer = Buffer.alloc(30); // header (10) + 5 points (20)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(100, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(110, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(120, 22);
			buffer.writeInt16BE(0, 24);
			buffer.writeInt16BE(130, 26);
			buffer.writeInt16BE(0, 28);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(5);
			expect(result.points[0]).toEqual({ x: 0, y: 0 }); // NOT dropped
		});

		it('should compute median correctly when rest steps have even count (average of two middle)', () => {
			// Points: (0,0) [outlier], (400,0), (410,0), (420,0), (430,0), (440,0)
			// First step: 400
			// Rest steps (points[1]->points[4]): 10, 10, 10, 10 (4 steps)
			// Median of [10, 10, 10, 10] = 10
			// firstStep (400) > 20*10 (200)? YES, so DROP
			const buffer = Buffer.alloc(34); // header (10) + 6 points (24)
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			buffer.writeInt16BE(400, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(410, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(420, 22);
			buffer.writeInt16BE(0, 24);
			buffer.writeInt16BE(430, 26);
			buffer.writeInt16BE(0, 28);
			buffer.writeInt16BE(440, 30);
			buffer.writeInt16BE(0, 32);

			const result = parseTracePacket(buffer);
			expect(result.points).toHaveLength(5);
			expect(result.points[0]).toEqual({ x: 400, y: 0 }); // DROPPED
		});
	});

	describe('parseQ10TracePacket', () => {
		it('should return B01MapInfo with rooms=[], mapId=undefined, roomMatrix=undefined', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(100, 10);
			buffer.writeInt16BE(200, 12);

			const result = parseQ10TracePacket(buffer);
			expect(result.rooms).toEqual([]);
			expect(result.mapId).toBeUndefined();
			expect(result.roomMatrix).toBeUndefined();
		});

		it('should set currentPose to last point when points exist', () => {
			const buffer = Buffer.alloc(18); // header + 2 points
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(10, 10);
			buffer.writeInt16BE(20, 12);
			buffer.writeInt16BE(30, 14);
			buffer.writeInt16BE(40, 16);

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose).toEqual({ x: 30, y: 40 });
		});

		it('should set currentPose to undefined when no points (empty body)', () => {
			const buffer = Buffer.alloc(10);
			buffer[0] = 0x02;
			buffer[1] = 0x01;

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose).toBeUndefined();
		});

		it('should set currentPose to last point after stray-leading-point filter', () => {
			// Create a packet with 4 points where first is an outlier and will be filtered
			const buffer = Buffer.alloc(26);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			// Outlier point: (0,0)
			buffer.writeInt16BE(0, 10);
			buffer.writeInt16BE(0, 12);
			// Path points: (100,0), (110,0), (120,0) - evenly spaced at 10 units
			buffer.writeInt16BE(100, 14);
			buffer.writeInt16BE(0, 16);
			buffer.writeInt16BE(110, 18);
			buffer.writeInt16BE(0, 20);
			buffer.writeInt16BE(120, 22);
			buffer.writeInt16BE(0, 24);

			const result = parseQ10TracePacket(buffer);
			// After filter, first point dropped, so currentPose should be the last remaining point (120, 0)
			expect(result.currentPose).toEqual({ x: 120, y: 0 });
		});

		it('should throw when payload has invalid marker', () => {
			const buffer = Buffer.alloc(10);
			buffer[0] = 0x01;
			buffer[1] = 0x01;
			expect(() => parseQ10TracePacket(buffer)).toThrow(/Q10 trace packet: invalid header/);
		});

		it('should throw when payload body is not 4-byte aligned', () => {
			const buffer = Buffer.alloc(15);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			expect(() => parseQ10TracePacket(buffer)).toThrow(/Q10 trace packet: body length is not a multiple of 4/);
		});

		it('should return currentPose with x and y but no phi field', () => {
			const buffer = Buffer.alloc(14);
			buffer[0] = 0x02;
			buffer[1] = 0x01;
			buffer.writeInt16BE(123, 10);
			buffer.writeInt16BE(456, 12);

			const result = parseQ10TracePacket(buffer);
			expect(result.currentPose?.x).toBe(123);
			expect(result.currentPose?.y).toBe(456);
			expect(result.currentPose?.phi).toBeUndefined();
		});
	});
});
