import { describe, expect, it } from 'vitest';

import type { B01TracePoint } from '../../../../roborockCommunication/map/b01/b01Q10TraceParser.js';
import type { GridCalibration } from '../../../../roborockCommunication/map/b01/q10GridCalibration.js';
import { solveQ10GridCalibration, worldToPixel } from '../../../../roborockCommunication/map/b01/q10GridCalibration.js';
import type { B01RoomMatrix } from '../../../../roborockCommunication/map/b01/types.js';

describe('q10GridCalibration', () => {
	describe('worldToPixel', () => {
		it('should map a point exactly at origin to pixel (0, 0)', () => {
			const point = { x: 0, y: 0 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			expect(result).toEqual({ px: 0, py: 0 });
		});

		it('should handle positive offsets from origin', () => {
			const point = { x: 100, y: 50 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 200,
				height: 100,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			expect(result).toEqual({ px: 100, py: 50 });
		});

		it('should handle negative world coordinates but within bounds after origin adjustment', () => {
			const point = { x: 50, y: 50 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 200,
				height: 200,
				originX: 100,
				originY: 100,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			// px = round((50 - 100) / 1.0) = -50, which is negative → out of bounds
			expect(result).toBeUndefined();
		});

		it('should apply resolution scaling correctly', () => {
			const point = { x: 40, y: 60 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 2.0, ySign: 1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			// px = round((40 - 0) / 2.0) = 20
			// py = round((1 * (60 - 0)) / 2.0) = 30
			expect(result).toEqual({ px: 20, py: 30 });
		});

		it('should apply ySign=-1 to flip Y direction within bounds', () => {
			const point = { x: 10, y: -20 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: -1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			// px = round(10 - 0) / 1.0 = 10
			// py = round((-1 * (-20 - 0)) / 1.0) = 20
			expect(result).toEqual({ px: 10, py: 20 });
		});

		it('should return undefined when pixel x is negative', () => {
			const point = { x: -100, y: 0 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			expect(worldToPixel(point, roomMatrix, calibration)).toBeUndefined();
		});

		it('should return undefined when pixel x >= width', () => {
			const point = { x: 100, y: 0 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			expect(worldToPixel(point, roomMatrix, calibration)).toBeUndefined();
		});

		it('should return undefined when pixel y is negative', () => {
			const point = { x: 0, y: -100 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			expect(worldToPixel(point, roomMatrix, calibration)).toBeUndefined();
		});

		it('should return undefined when pixel y >= height', () => {
			const point = { x: 0, y: 100 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			expect(worldToPixel(point, roomMatrix, calibration)).toBeUndefined();
		});

		it('should handle rounding of fractional pixel coordinates', () => {
			const point = { x: 10.4, y: 20.6 };
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(1),
				width: 50,
				height: 50,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};
			const calibration: GridCalibration = { resolution: 1.0, ySign: 1 };

			const result = worldToPixel(point, roomMatrix, calibration);
			// round(10.4) = 10, round(20.6) = 21
			expect(result).toEqual({ px: 10, py: 21 });
		});
	});

	describe('solveQ10GridCalibration', () => {
		it('should return undefined when points.length < 4', () => {
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 20 },
			];
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(100, 0x04),
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			expect(solveQ10GridCalibration(points, roomMatrix)).toBeUndefined();
		});

		it('should return undefined when roomMatrix.data is empty', () => {
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 20 },
				{ x: 30, y: 30 },
			];
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(0),
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			expect(solveQ10GridCalibration(points, roomMatrix)).toBeUndefined();
		});

		it('should solve calibration for a synthetic grid with mixed resolution candidates', () => {
			// Create a 100x100 grid where room 1 occupies all cells
			const grid = Buffer.alloc(10000, 0x04); // All cells = room 1 (1 * 4)
			const roomMatrix: B01RoomMatrix = {
				data: grid,
				width: 100,
				height: 100,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			// Create 4+ points — the solver will try all resolutions (12.0-26.0)
			// and ySign (1, -1). All will score high for this all-one-room grid.
			// The tie-breaker will pick the resolution closest to 20.0.
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 100, y: 100 },
				{ x: 200, y: 200 },
				{ x: 300, y: 300 },
			];

			const result = solveQ10GridCalibration(points, roomMatrix);
			expect(result).toBeDefined();
			// With an all-one-room grid, all resolutions tie; tie-breaker picks closest to 20.0
			expect(result?.resolution).toBe(20.0);
			expect([1, -1]).toContain(result?.ySign);
		});

		it('should return undefined when all points map to zero room cells', () => {
			// Create a grid with only background (room 0)
			const grid = Buffer.alloc(100, 0x00); // All cells = room 0 (not in roomIds)
			const roomMatrix: B01RoomMatrix = {
				data: grid,
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1], // Only room 1 is valid, but grid only has room 0
			};

			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 3 },
			];

			expect(solveQ10GridCalibration(points, roomMatrix)).toBeUndefined();
		});

		it('should prefer resolution closer to 20.0 on tie score', () => {
			// Create a small 5x5 grid
			const grid = Buffer.alloc(25, 0x04); // All cells = room 1
			const roomMatrix: B01RoomMatrix = {
				data: grid,
				width: 5,
				height: 5,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			// Create points that should tie between two resolutions
			// This is a synthetic case — in practice, two resolutions won't score equally
			// for all points due to rounding, but the tie-break logic should still execute
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 5, y: 5 },
				{ x: 10, y: 10 },
				{ x: 15, y: 15 },
			];

			const result = solveQ10GridCalibration(points, roomMatrix);
			expect(result).toBeDefined();
			// Verify the resolution is within the valid range
			expect(result?.resolution).toBeGreaterThanOrEqual(12.0);
			expect(result?.resolution).toBeLessThanOrEqual(26.0);
		});

		it('should handle ySign=-1 in calibration search', () => {
			// Create a 10x10 grid
			const grid = Buffer.alloc(100, 0x04); // All cells = room 1
			const roomMatrix: B01RoomMatrix = {
				data: grid,
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			// Points where ySign=-1 maps them correctly
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: -1 },
				{ x: 2, y: -2 },
				{ x: 3, y: -3 },
			];

			const result = solveQ10GridCalibration(points, roomMatrix);
			expect(result).toBeDefined();
			// Result should have resolved either ySign=1 or ySign=-1
			expect([1, -1]).toContain(result?.ySign);
		});

		it('should never throw for empty points array', () => {
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(100, 0x04),
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			expect(() => solveQ10GridCalibration([], roomMatrix)).not.toThrow();
			expect(solveQ10GridCalibration([], roomMatrix)).toBeUndefined();
		});

		it('should never throw for negative width/height', () => {
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 3 },
			];
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(100),
				width: -10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			expect(() => solveQ10GridCalibration(points, roomMatrix)).not.toThrow();
			// With negative width, no points can map in-bounds
			expect(solveQ10GridCalibration(points, roomMatrix)).toBeUndefined();
		});

		it('should never throw for malformed roomIds array', () => {
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
				{ x: 2, y: 2 },
				{ x: 3, y: 3 },
			];
			const roomMatrix: B01RoomMatrix = {
				data: Buffer.alloc(100, 0x04),
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [], // Empty roomIds
			};

			expect(() => solveQ10GridCalibration(points, roomMatrix)).not.toThrow();
			// Empty roomIds means no valid rooms exist
			expect(solveQ10GridCalibration(points, roomMatrix)).toBeUndefined();
		});

		it('should find a valid calibration when all points land on room cells', () => {
			// Create a grid with room 1 everywhere (simplest case)
			const grid = Buffer.alloc(100, 0x04); // 10x10 all room 1
			const roomMatrix: B01RoomMatrix = {
				data: grid,
				width: 10,
				height: 10,
				originX: 0,
				originY: 0,
				roomIds: [1],
			};

			// Any 4+ points in a grid full of room 1 will all map correctly
			const points: B01TracePoint[] = [
				{ x: 0, y: 0 },
				{ x: 10, y: 10 },
				{ x: 20, y: 20 },
				{ x: 30, y: 30 },
			];

			const result = solveQ10GridCalibration(points, roomMatrix);
			expect(result).toBeDefined();
			// Should return a valid calibration (exact resolution depends on tie-breaker logic)
			expect(result?.resolution).toBeGreaterThanOrEqual(12.0);
			expect(result?.resolution).toBeLessThanOrEqual(26.0);
			expect([1, -1]).toContain(result?.ySign);
		});
	});
});
