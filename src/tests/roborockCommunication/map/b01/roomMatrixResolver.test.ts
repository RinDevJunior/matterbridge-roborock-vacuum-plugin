import { describe, expect, it } from 'vitest';

import { resolveRoomFromPose } from '../../../../roborockCommunication/map/b01/roomMatrixResolver.js';
import type { B01Pose, B01RoomMatrix } from '../../../../roborockCommunication/map/b01/types.js';

// No physical Q10 device data exists — all fixtures below are synthetic, hand-constructed
// values consistent with the B01Pose/B01RoomMatrix types, not captured real-world data.

describe('resolveRoomFromPose', () => {
	it('should return undefined when pose is undefined, regardless of roomMatrix state', () => {
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1, 2, 3]) };
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
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1, 2, 3]) };
		expect(resolveRoomFromPose(malformedPose, roomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is not a Buffer (defensive guard)', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const malformedRoomMatrix = { data: 'not-a-buffer' } as unknown as B01RoomMatrix;
		expect(resolveRoomFromPose(pose, malformedRoomMatrix)).toBeUndefined();
	});

	it('should return undefined when roomMatrix.data is an empty Buffer', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = { data: Buffer.alloc(0) };
		expect(resolveRoomFromPose(pose, roomMatrix)).toBeUndefined();
	});

	it('should return undefined even with a fully well-formed pose and non-empty roomMatrix.data (current, intentional no-op behavior)', () => {
		// LOCKS IN "always undefined for now" as expected behavior. resolveRoomFromPose's
		// pixel-to-room lookup body is deliberately unimplemented per plan.md — a future PR that
		// adds real decoding logic must consciously update this test, not accidentally regress
		// this into a silent behavior change.
		const pose: B01Pose = { x: 123.4, y: 567.8, phi: 1.57 };
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1, 2, 3, 4, 5]) };
		expect(resolveRoomFromPose(pose, roomMatrix)).toBeUndefined();
	});

	it('should never throw for any combination of missing/malformed/empty/well-formed inputs', () => {
		const pose: B01Pose = { x: 1, y: 2 };
		const roomMatrix: B01RoomMatrix = { data: Buffer.from([1]) };
		const cases: Array<[B01Pose | undefined, B01RoomMatrix | undefined]> = [
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
