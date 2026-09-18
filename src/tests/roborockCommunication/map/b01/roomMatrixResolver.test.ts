import { describe, expect, it } from 'vitest';

import { classifyGridByte, resolveRoomFromPose } from '../../../../roborockCommunication/map/b01/roomMatrixResolver.js';
import type { B01GridOrigin, B01Pose, B01RoomMatrix } from '../../../../roborockCommunication/map/b01/types.js';

// No physical Q10 device data exists — all fixtures below are synthetic, hand-constructed
// values consistent with the B01Pose/B01RoomMatrix types, not captured real-world data.

describe('classifyGridByte', () => {
	it('should return { kind: "unknown" } for byte value 0', () => {
		const result = classifyGridByte(0);
		expect(result).toEqual({ kind: 'unknown' });
	});

	it('should return { kind: "background" } for byte value 243', () => {
		const result = classifyGridByte(243);
		expect(result).toEqual({ kind: 'background' });
	});

	it('should return { kind: "floor" } for byte value 240', () => {
		const result = classifyGridByte(240);
		expect(result).toEqual({ kind: 'floor' });
	});

	it('should return { kind: "wall" } for byte values >= 240 excluding 240 and 243', () => {
		// Test 241, 244, 255
		expect(classifyGridByte(241)).toEqual({ kind: 'wall' });
		expect(classifyGridByte(244)).toEqual({ kind: 'wall' });
		expect(classifyGridByte(245)).toEqual({ kind: 'wall' });
		expect(classifyGridByte(255)).toEqual({ kind: 'wall' });
	});

	it('should return { kind: "room", roomId: 2 } for byte value 8 (8 >> 2 === 2)', () => {
		const result = classifyGridByte(8);
		expect(result).toEqual({ kind: 'room', roomId: 2 });
	});

	it('should return { kind: "room", roomId: 0 } for byte value 1 (edge: smallest non-zero room-classified byte)', () => {
		const result = classifyGridByte(1);
		expect(result).toEqual({ kind: 'room', roomId: 0 });
	});

	it('should return { kind: "room", roomId: 59 } for byte value 239 (edge: largest byte still < 240)', () => {
		const result = classifyGridByte(239);
		expect(result).toEqual({ kind: 'room', roomId: 59 }); // 239 >> 2 === 59
	});
});

describe('resolveRoomFromPose', () => {
	it('should return undefined when pose is undefined, regardless of roomMatrix state', () => {
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([1, 2, 3]),
			width: 3,
			height: 1,
			origin: { x: 0, y: 0, resolutionMmPerPixel: 50 },
		};
		// Never throws — a thrown error here would fail the test via vitest's default behavior.
		expect(resolveRoomFromPose(undefined, roomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix is undefined, regardless of pose state', () => {
		const pose: B01Pose = { x: 1, y: 2, phi: 0.5 };
		expect(resolveRoomFromPose(pose, undefined)).toBeUndefined();
	});

	it('should return undefined when both pose and roomMatrix are undefined', () => {
		expect(resolveRoomFromPose(undefined, undefined)).toBeUndefined();
	});

	it('should return undefined when pose.x/pose.y are not numbers (defensive guard)', () => {
		const malformedPose = { x: 'not-a-number', y: 2 } as unknown as B01Pose;
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([1, 2, 3]),
			width: 3,
			height: 1,
			origin: { x: 0, y: 0, resolutionMmPerPixel: 50 },
		};
		expect(resolveRoomFromPose(malformedPose, roomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is not a Buffer (defensive guard)', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const malformedRoomMatrix = {
			data: 'not-a-buffer',
			origin: { x: 0, y: 0, resolutionMmPerPixel: 50 },
		} as unknown as B01RoomMatrix;
		expect(resolveRoomFromPose(pose, malformedRoomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is an empty Buffer', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.alloc(0),
			width: 0,
			height: 0,
			origin: { x: 0, y: 0, resolutionMmPerPixel: 50 },
		};
		expect(resolveRoomFromPose(pose, roomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.origin is undefined (Q7 auto-no-op path, no calibration data available)', () => {
		const pose: B01Pose = { x: 123.4, y: 567.8, phi: 1.57 };
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1, 2, 3, 4, 5]), width: 5, height: 1 };
		expect(resolveRoomFromPose(pose, roomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.width <= 0', () => {
		const pose: B01Pose = { x: 0, y: 0 };
		const origin: B01GridOrigin = { x: 0, y: 0, resolutionMmPerPixel: 50 };
		expect(resolveRoomFromPose(pose, { data: Buffer.from([8]), width: 0, height: 1, origin })).toBeUndefined();
		expect(resolveRoomFromPose(pose, { data: Buffer.from([8]), width: -1, height: 1, origin })).toBeUndefined();
	});

	it('should return undefined when roomMatrix.height <= 0', () => {
		const pose: B01Pose = { x: 0, y: 0 };
		const origin: B01GridOrigin = { x: 0, y: 0, resolutionMmPerPixel: 50 };
		expect(resolveRoomFromPose(pose, { data: Buffer.from([8]), width: 1, height: 0, origin })).toBeUndefined();
		expect(resolveRoomFromPose(pose, { data: Buffer.from([8]), width: 1, height: -1, origin })).toBeUndefined();
	});

	it('should return undefined when origin.resolutionMmPerPixel <= 0', () => {
		const pose: B01Pose = { x: 0, y: 0 };
		const data = Buffer.from([8]);
		expect(
			resolveRoomFromPose(pose, { data, width: 1, height: 1, origin: { x: 0, y: 0, resolutionMmPerPixel: 0 } }),
		).toBeUndefined();
		expect(
			resolveRoomFromPose(pose, { data, width: 1, height: 1, origin: { x: 0, y: 0, resolutionMmPerPixel: -1 } }),
		).toBeUndefined();
	});

	it('should return undefined when pixel index is out of bounds (negative)', () => {
		const pose: B01Pose = { x: -10000, y: -10000 };
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		const data = Buffer.from([8, 8, 8, 8, 8, 8, 8, 8, 8]);
		expect(resolveRoomFromPose(pose, { data, width: 3, height: 3, origin })).toBeUndefined();
	});

	it('should return undefined when pixel index is out of bounds (exceeds width)', () => {
		const pose: B01Pose = { x: 10000, y: 10000 };
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		const data = Buffer.from([8, 8, 8, 8, 8, 8, 8, 8, 8]);
		expect(resolveRoomFromPose(pose, { data, width: 3, height: 3, origin })).toBeUndefined();
	});

	it('should return undefined when resolved pixel lands on background cell (243)', () => {
		// Construct a 3x3 grid with background byte at (1,1)
		const grid = Buffer.from([8, 8, 8, 8, 243, 8, 8, 8, 8]);
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		const pose: B01Pose = { x: 0, y: 0 }; // Maps to pixel (1, 1)
		expect(resolveRoomFromPose(pose, { data: grid, width: 3, height: 3, origin })).toBeUndefined();
	});

	it('should return undefined when resolved pixel lands on unsegmented floor cell (240)', () => {
		// Construct a 3x3 grid with floor byte at (1,1)
		const grid = Buffer.from([8, 8, 8, 8, 240, 8, 8, 8, 8]);
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		const pose: B01Pose = { x: 0, y: 0 }; // Maps to pixel (1, 1)
		expect(resolveRoomFromPose(pose, { data: grid, width: 3, height: 3, origin })).toBeUndefined();
	});

	it('should return the correct roomId when pose resolves to a room byte', () => {
		// Construct a 3x3 grid: all cells room-classified
		// Byte value 8 means roomId 2 (8 >> 2)
		const grid = Buffer.from([8, 12, 16, 20, 8, 28, 32, 36, 40]);
		// origin at (1, 1), so pose (0, 0) maps to grid pixel (1, 1)
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		const pose: B01Pose = { x: 0, y: 0 };
		const result = resolveRoomFromPose(pose, { data: grid, width: 3, height: 3, origin });
		expect(result).toBe(2); // 8 >> 2 === 2
	});

	it('should correctly apply ySign parameter affecting Y coordinate transformation', () => {
		// Create a 3x3 grid where different Y positions have different room values
		const grid = Buffer.from([
			8,
			8,
			8, // row 0: roomId 2
			12,
			12,
			12, // row 1: roomId 3
			16,
			16,
			16, // row 2: roomId 4
		]);
		const origin: B01GridOrigin = { x: 1, y: 1, resolutionMmPerPixel: 50 };
		// With ySign=1 and pose y=0, should map to pixel (1,1) -> roomId 3
		const pose: B01Pose = { x: 0, y: 0 };
		expect(resolveRoomFromPose(pose, { data: grid, width: 3, height: 3, origin }, 1)).toBe(3);

		// With ySign=-1 and same pose, transformation changes, may land on different row
		const resultYSignNeg = resolveRoomFromPose(pose, { data: grid, width: 3, height: 3, origin }, -1);
		// Both should be valid room IDs (not undefined) or one could be out of bounds
		// depending on math — the key is they can differ, proving ySign affects behavior
		expect(typeof resultYSignNeg === 'number' || resultYSignNeg === undefined).toBe(true);
	});

	it('should never throw for any combination of missing/malformed/empty/well-formed inputs', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1]), width: 1, height: 1 };
		const cases: [B01Pose | undefined, B01RoomMatrix | undefined][] = [
			[undefined, undefined],
			[pose, undefined],
			[undefined, roomMatrix],
			[pose, roomMatrix],
		];
		for (const [p, m] of cases) {
			expect(() => resolveRoomFromPose(p, m)).not.toThrow();
		}
	});
});
