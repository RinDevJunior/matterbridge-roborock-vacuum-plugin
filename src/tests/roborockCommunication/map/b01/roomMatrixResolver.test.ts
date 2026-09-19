import { describe, expect, it } from 'vitest';

import type { GridCalibration } from '../../../../roborockCommunication/map/b01/q10GridCalibration.js';
import { resolveRoomFromPose } from '../../../../roborockCommunication/map/b01/roomMatrixResolver.js';
import type { B01Pose, B01RoomMatrix } from '../../../../roborockCommunication/map/b01/types.js';

// No physical Q10 device data exists — all fixtures below are synthetic, hand-constructed
// values consistent with the B01Pose/B01RoomMatrix types, not captured real-world data.

describe('resolveRoomFromPose', () => {
	it('should return undefined when pose is undefined, regardless of roomMatrix state', () => {
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04, 0x08, 0x0c]),
			width: 3,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1, 2, 3],
		};
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		// Never throws — a thrown error here would fail the test via vitest's default behavior.
		expect(resolveRoomFromPose(undefined, roomMatrix, calibration)).toBeUndefined();
	});

	it('should return undefined when roomMatrix is undefined, regardless of pose state', () => {
		const pose: B01Pose = { x: 1, y: 2, phi: 0.5 };
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		expect(resolveRoomFromPose(pose, undefined, calibration)).toBeUndefined();
	});

	it('should return undefined when calibration is undefined', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04]),
			width: 1,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		expect(resolveRoomFromPose(pose, roomMatrix, undefined)).toBeUndefined();
	});

	it('should return undefined when all three parameters are undefined', () => {
		expect(resolveRoomFromPose(undefined, undefined, undefined)).toBeUndefined();
	});

	it('should return undefined when pose.x/pose.y are not numbers (defensive guard)', () => {
		const malformedPose = { x: 'not-a-number', y: 2 } as unknown as B01Pose;
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04]),
			width: 1,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		expect(resolveRoomFromPose(malformedPose, roomMatrix, calibration)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is not a Buffer (defensive guard)', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const malformedRoomMatrix = {
			data: 'not-a-buffer',
			width: 1,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		} as unknown as B01RoomMatrix;
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		expect(resolveRoomFromPose(pose, malformedRoomMatrix, calibration)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is an empty Buffer', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.alloc(0),
			width: 1,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		expect(resolveRoomFromPose(pose, roomMatrix, calibration)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.width or height is zero or negative', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };

		const zeroWidthMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04]),
			width: 0,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		expect(resolveRoomFromPose(pose, zeroWidthMatrix, calibration)).toBeUndefined();

		const negativeHeightMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04]),
			width: 1,
			height: -1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		expect(resolveRoomFromPose(pose, negativeHeightMatrix, calibration)).toBeUndefined();
	});

	it('should return a room ID when pose, roomMatrix, and calibration resolve to a valid room cell', () => {
		// Create a 10x10 grid where room 1 occupies cell (0,0)
		// Each cell encodes: pixel_value = roomId * 4
		const gridData = Buffer.alloc(100, 0x00);
		gridData[0] = 1 * 4; // Cell (0,0) = room 1

		const pose: B01Pose = { x: 0, y: 0 }; // At origin
		const roomMatrix: B01RoomMatrix = {
			data: gridData,
			width: 10,
			height: 10,
			originX: 0,
			originY: 0,
			roomIds: [1, 2, 3],
		};
		const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

		expect(resolveRoomFromPose(pose, roomMatrix, calibration)).toBe(1);
	});

	it('should return undefined when the cell at the pose location contains a room ID not in roomMatrix.roomIds', () => {
		// Create grid where cell (0,0) encodes room 99 (not in roomIds list)
		const gridData = Buffer.alloc(4, 0x00);
		gridData[0] = 99 * 4; // Cell (0,0) = room 99 (unknown)

		const pose: B01Pose = { x: 0, y: 0 };
		const roomMatrix: B01RoomMatrix = {
			data: gridData,
			width: 2,
			height: 2,
			originX: 0,
			originY: 0,
			roomIds: [1, 2], // Room 99 is NOT in this list
		};
		const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

		expect(resolveRoomFromPose(pose, roomMatrix, calibration)).toBeUndefined();
	});

	it('should return undefined when pose maps outside grid bounds', () => {
		const gridData = Buffer.alloc(4, 0x00);
		gridData[0] = 1 * 4;

		const pose: B01Pose = { x: 100, y: 100 }; // Way outside grid
		const roomMatrix: B01RoomMatrix = {
			data: gridData,
			width: 2,
			height: 2,
			originX: 0,
			originY: 0,
			roomIds: [1, 2],
		};
		const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

		expect(resolveRoomFromPose(pose, roomMatrix, calibration)).toBeUndefined();
	});

	it('should never throw for any combination of missing/malformed/empty/well-formed inputs', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = {
			data: Buffer.from([0x04]),
			width: 1,
			height: 1,
			originX: 0,
			originY: 0,
			roomIds: [1],
		};
		const calibration: GridCalibration = { resolution: 20.0, ySign: 1 };
		const cases: [B01Pose | undefined, B01RoomMatrix | undefined, GridCalibration | undefined][] = [
			[undefined, undefined, undefined],
			[pose, undefined, undefined],
			[undefined, roomMatrix, undefined],
			[undefined, undefined, calibration],
			[pose, roomMatrix, undefined],
			[pose, roomMatrix, calibration],
		];
		for (const [p, m, c] of cases) {
			expect(() => resolveRoomFromPose(p, m, c)).not.toThrow();
		}
	});
});
