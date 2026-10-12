import { describe, expect, it } from 'vitest';

import { parseQ10TracePacket, parseTracePacket } from '../../../../roborockCommunication/map/b01/b01Q10TraceParser.js';

interface Point {
	x: number;
	y: number;
}

/** Builds a Q10 trace packet: 10-byte header (0x02 0x01 marker, session counter at offset 3) + i16be point pairs. */
function buildTracePacket(sessionCounter: number, points: Point[]): Buffer {
	const header = Buffer.alloc(10);
	header[0] = 0x02;
	header[1] = 0x01;
	header.writeUInt8(sessionCounter, 3);
	const body = Buffer.alloc(points.length * 4);
	points.forEach((p, i) => {
		body.writeInt16BE(p.x, i * 4);
		body.writeInt16BE(p.y, i * 4 + 2);
	});
	return Buffer.concat([header, body]);
}

describe('parseTracePacket', () => {
	it('should throw when payload is shorter than the trace header', () => {
		// Arrange
		const payload = Buffer.from([0x02, 0x01, 0x00]);
		// Act & Assert
		expect(() => parseTracePacket(payload)).toThrow('Q10 trace packet: invalid header or unrecognized marker bytes');
	});

	it('should throw when marker bytes do not match the trace marker', () => {
		// Arrange
		const payload = buildTracePacket(1, [{ x: 1, y: 1 }]);
		payload[0] = 0x01;
		// Act & Assert
		expect(() => parseTracePacket(payload)).toThrow('Q10 trace packet: invalid header or unrecognized marker bytes');
	});

	it('should throw when body length is not a multiple of four bytes', () => {
		// Arrange
		const header = buildTracePacket(1, []);
		const payload = Buffer.concat([header, Buffer.from([0x00, 0x01, 0x02])]);
		// Act & Assert
		expect(() => parseTracePacket(payload)).toThrow(/not a multiple of 4/);
	});

	it('should return the session counter and parsed points when there are fewer than three points', () => {
		// Arrange
		const payload = buildTracePacket(42, [
			{ x: 1, y: 2 },
			{ x: -5, y: -300 },
		]);
		// Act
		const result = parseTracePacket(payload);
		// Assert
		expect(result.sessionCounter).toBe(42);
		expect(result.points).toEqual([
			{ x: 1, y: 2 },
			{ x: -5, y: -300 },
		]);
	});

	it('should drop the leading point when its step is more than 20x the median rest step', () => {
		// Arrange
		const payload = buildTracePacket(1, [
			{ x: 0, y: 0 },
			{ x: 1000, y: 0 },
			{ x: 1001, y: 0 },
			{ x: 1002, y: 0 },
			{ x: 1003, y: 0 },
		]);
		// Act
		const { points } = parseTracePacket(payload);
		// Assert
		expect(points).toEqual([
			{ x: 1000, y: 0 },
			{ x: 1001, y: 0 },
			{ x: 1002, y: 0 },
			{ x: 1003, y: 0 },
		]);
	});

	it('should drop the leading point using the even-count median of rest steps', () => {
		// Arrange: rest steps are [1, 1] (even count), median 1, first step 1000
		const payload = buildTracePacket(1, [
			{ x: 0, y: 0 },
			{ x: 1000, y: 0 },
			{ x: 1001, y: 0 },
			{ x: 1002, y: 0 },
		]);
		// Act
		const { points } = parseTracePacket(payload);
		// Assert
		expect(points).toEqual([
			{ x: 1000, y: 0 },
			{ x: 1001, y: 0 },
			{ x: 1002, y: 0 },
		]);
	});

	it('should keep the leading point when its step is within 20x the median rest step', () => {
		// Arrange: first step 10, median rest step 1 (10 is not > 20)
		const payload = buildTracePacket(1, [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 11, y: 0 },
			{ x: 12, y: 0 },
			{ x: 13, y: 0 },
		]);
		// Act
		const { points } = parseTracePacket(payload);
		// Assert
		expect(points).toHaveLength(5);
		expect(points[0]).toEqual({ x: 0, y: 0 });
	});

	it('should keep all points when the median rest step is zero', () => {
		// Arrange: rest steps are [0, 0], so the ratio cannot be computed and nothing is dropped
		const payload = buildTracePacket(1, [
			{ x: 0, y: 0 },
			{ x: 500, y: 0 },
			{ x: 500, y: 0 },
			{ x: 500, y: 0 },
		]);
		// Act
		const { points } = parseTracePacket(payload);
		// Assert
		expect(points).toHaveLength(4);
		expect(points[0]).toEqual({ x: 0, y: 0 });
	});
});

describe('parseQ10TracePacket', () => {
	it('should return the last point as currentPose with empty rooms and undefined mapId and roomMatrix', () => {
		// Arrange
		const payload = buildTracePacket(1, [
			{ x: 1, y: 2 },
			{ x: 3, y: 4 },
			{ x: 5, y: 6 },
		]);
		// Act
		const result = parseQ10TracePacket(payload);
		// Assert
		expect(result).toEqual({
			rooms: [],
			mapId: undefined,
			currentPose: { x: 5, y: 6 },
			roomMatrix: undefined,
		});
	});

	it('should return undefined currentPose when the packet carries no points', () => {
		// Arrange
		const payload = buildTracePacket(1, []);
		// Act
		const result = parseQ10TracePacket(payload);
		// Assert
		expect(result.currentPose).toBeUndefined();
		expect(result.rooms).toEqual([]);
	});
});
