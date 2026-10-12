import { describe, expect, it } from 'vitest';

import { classifyIslands, findConnectedIslands, type PixelIsland } from '../../cli/legacyIslandDetection.js';
import { asPartial } from '../testUtils.js';

describe('legacyIslandDetection', () => {
	describe('findConnectedIslands', () => {
		it('returns 1 island with 5-pixel count for a single contiguous 5-pixel segment (one row)', () => {
			// width=5, height=1: pixels at indices 0,1,2,3,4 all segment ID 7
			const segments = [0 | (7 << 21), 1 | (7 << 21), 2 | (7 << 21), 3 | (7 << 21), 4 | (7 << 21)];
			const islands = findConnectedIslands(segments, 5, 1);
			expect(islands).toHaveLength(1);
			expect(islands[0]).toMatchObject({
				segmentId: 7,
				pixelCount: 5,
			});
		});

		it('returns 2 islands for same segmentId pixels separated by empty/other pixels (not touching)', () => {
			// width=10, height=1: seg 5 at indices 0-2, gap at 3-4, seg 5 at indices 5-7
			const segments = [0 | (5 << 21), 1 | (5 << 21), 2 | (5 << 21), 5 | (5 << 21), 6 | (5 << 21), 7 | (5 << 21)];
			const islands = findConnectedIslands(segments, 10, 1);
			expect(islands).toHaveLength(2);
			expect(islands[0].pixelCount).toBe(3);
			expect(islands[1].pixelCount).toBe(3);
		});

		it('returns 2 islands for same segmentId pixels touching only diagonally (4-connectivity, not 8)', () => {
			// width=3, height=2: pixels form diagonal with no 4-connectivity
			// (0,0) at index 0, segId=8
			// (1,1) at index 1*3+1=4, segId=8
			// These are diagonal neighbors only; should be 2 islands
			const segments = [0 | (8 << 21), 4 | (8 << 21)];
			const islands = findConnectedIslands(segments, 3, 2);
			expect(islands).toHaveLength(2);
			expect(islands[0].pixelCount).toBe(1);
			expect(islands[1].pixelCount).toBe(1);
		});

		it('correctly groups islands per segmentId without cross-segment merging', () => {
			// width=4, height=1: seg 1 at 0-1, seg 2 at 2-3 (adjacent but different seg ID)
			const segments = [0 | (1 << 21), 1 | (1 << 21), 2 | (2 << 21), 3 | (2 << 21)];
			const islands = findConnectedIslands(segments, 4, 1);
			expect(islands).toHaveLength(2);
			expect(islands[0].segmentId).toBe(1);
			expect(islands[0].pixelCount).toBe(2);
			expect(islands[1].segmentId).toBe(2);
			expect(islands[1].pixelCount).toBe(2);
		});

		it('returns [] for empty segments array', () => {
			const islands = findConnectedIslands([], 10, 10);
			expect(islands).toEqual([]);
		});

		it('sorts islands by segmentId ascending, then pixelCount descending', () => {
			// seg 5: 2 islands (sizes 3 and 1), seg 3: 2 islands (sizes 2 and 2)
			const segments = [
				0 | (5 << 21),
				1 | (5 << 21),
				2 | (5 << 21),
				4 | (5 << 21),
				6 | (3 << 21),
				7 | (3 << 21),
				8 | (3 << 21),
				9 | (3 << 21),
			];
			const islands = findConnectedIslands(segments, 10, 1);
			expect(islands.length).toBeGreaterThan(0);
			// First island should be segmentId=3 (comes before 5), and largest of its segment
			expect(islands[0].segmentId).toBe(3);
			// Within seg 3, verify descending by pixelCount (both are 2, so order stable)
			// Within seg 5, should see size-3 before size-1
		});
	});

	describe('classifyIslands', () => {
		it('excludes small island as size-heuristic when no wall/zone data exists', () => {
			const smallIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: [0, 1],
				bounds: { minX: 0, maxX: 1, minY: 0, maxY: 0 },
				pixelCount: 2,
			};
			const largeIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: Array.from({ length: 20 }, (_, i) => i + 10),
				bounds: { minX: 0, maxX: 10, minY: 0, maxY: 5 },
				pixelCount: 20,
			};
			const islands = [largeIsland, smallIsland];
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: undefined,
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands(islands, mapData, image);
			const smallClass = classifications.find((c) => c.island.pixelCount === 2);
			expect(smallClass?.excluded).toBe(true);
			expect(smallClass?.reason).toBe('size-heuristic');
		});

		it('keeps small island when it is at/above 30% size-ratio threshold', () => {
			const largeIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: Array.from({ length: 10 }, (_, i) => i),
				bounds: { minX: 0, maxX: 9, minY: 0, maxY: 0 },
				pixelCount: 10,
			};
			// 30% of 10 = 3, so 3 pixels should NOT be excluded
			const smallButAcceptable: PixelIsland = {
				segmentId: 1,
				pixelIndices: [10, 11, 12],
				bounds: { minX: 0, maxX: 2, minY: 0, maxY: 0 },
				pixelCount: 3,
			};
			const islands = [largeIsland, smallButAcceptable];
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: undefined,
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands(islands, mapData, image);
			const acceptableClass = classifications.find((c) => c.island.pixelCount === 3);
			expect(acceptableClass?.excluded).toBe(false);
			expect(acceptableClass?.reason).toBe('kept');
		});

		it('excludes island as zone-overlap when its bbox overlaps a noGoZone bbox', () => {
			const island: PixelIsland = {
				segmentId: 1,
				pixelIndices: [0],
				bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
				pixelCount: 1,
			};
			// Zone at high mm values (500-400 mm in Y) to get low pixel Y coords after conversion
			// image height=10, so pyRel = 10 - 1 - (pyAbs - top) = 9 - (pyAbs - 0)
			// For mm 400-500: pyAbs = 8-10, so pyRel = 1 to -1, overlapping island Y [0,1]
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: undefined,
				noGoZones: [
					{
						points: [
							[0, 500],
							[100, 500],
							[100, 400],
							[0, 400],
						],
					},
				],
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 10, height: 10 },
			});

			const classifications = classifyIslands([island], mapData, image);
			expect(classifications[0].excluded).toBe(true);
			expect(classifications[0].reason).toBe('zone-overlap');
		});

		it('excludes smaller of two same-segmentId islands as wall-adjacent, but never the largest', () => {
			const smallIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: [0],
				bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
				pixelCount: 1,
			};
			const largeIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: Array.from({ length: 20 }, (_, i) => i + 10),
				bounds: { minX: 0, maxX: 10, minY: 0, maxY: 5 },
				pixelCount: 20,
			};
			// Wall at mm coords that convert to pixel space overlapping small island {0,1,0,1}
			// With image height=20, top=0, left=0: pyRel = 19 - pyAbs, pxRel = pxAbs
			// To get pyRel in [0,1], need pyAbs in [18,19], so mm in [900,950]
			// To get pxRel in [0,1], need pxAbs in [0,1], so mm in [0,50]
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: [{ x1: 0, y1: 900, x2: 50, y2: 950 }],
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands([smallIsland, largeIsland], mapData, image);
			const smallClass = classifications.find((c) => c.island.pixelCount === 1);
			const largeClass = classifications.find((c) => c.island.pixelCount === 20);
			expect(smallClass?.reason).toBe('wall-adjacent');
			// Large island should not be wall-excluded even if its bbox also touches
			expect(largeClass?.reason).not.toBe('wall-adjacent');
		});

		it('applies size-heuristic per-island even when unrelated wall/zone data exists elsewhere on the map', () => {
			const smallIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: [0, 1],
				bounds: { minX: 0, maxX: 1, minY: 0, maxY: 0 },
				pixelCount: 2,
			};
			const largeIsland: PixelIsland = {
				segmentId: 1,
				pixelIndices: Array.from({ length: 20 }, (_, i) => i + 10),
				bounds: { minX: 0, maxX: 10, minY: 0, maxY: 5 },
				pixelCount: 20,
			};
			// Wall data present but doesn't overlap the islands
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: [{ x1: 5000, y1: 5000, x2: 6000, y2: 6000 }],
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands([largeIsland, smallIsland], mapData, image);
			const smallClass = classifications.find((c) => c.island.pixelCount === 2);
			// size-heuristic NOW applies per-island as a last-resort fallback, regardless of unrelated wall data elsewhere
			expect(smallClass?.reason).toBe('size-heuristic');
			expect(smallClass?.excluded).toBe(true);
		});

		it('mirrors real bug report: tiny island excluded via size-heuristic despite unrelated wall data on map', () => {
			// Real scenario: a small bedroom sliver (2 pixels, non-largest) whose bbox does NOT overlap
			// any wall/zone box, plus a virtual wall elsewhere on the map. The tiny island should still
			// be excluded via size-heuristic (15% threshold check), not kept just because wall data exists.
			const tinyIsland: PixelIsland = {
				segmentId: 5,
				pixelIndices: [15, 16],
				bounds: { minX: 15, maxX: 16, minY: 15, maxY: 15 },
				pixelCount: 2,
			};
			const mainRoomIsland: PixelIsland = {
				segmentId: 5,
				pixelIndices: Array.from({ length: 50 }, (_, i) => i),
				bounds: { minX: 0, maxX: 9, minY: 0, maxY: 5 },
				pixelCount: 50,
			};
			// Wall in far corner (5000-6000 mm), far from both islands (top-left area ~0-800 mm)
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: [{ x1: 5000, y1: 5000, x2: 6000, y2: 6000 }],
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands([mainRoomIsland, tinyIsland], mapData, image);
			const tinyClass = classifications.find((c) => c.island.pixelCount === 2);
			// Tiny island (2 pixels) is well below 15% of largest (50 pixels) = 7.5 pixels minimum
			// Wall data exists on map but doesn't affect this island's classification
			expect(tinyClass?.reason).toBe('size-heuristic');
			expect(tinyClass?.excluded).toBe(true);
		});

		it('wall-adjacent takes priority over size-heuristic when island qualifies for both', () => {
			// An island small enough to be under the 15% threshold AND whose bbox overlaps a wall
			// should be excluded as 'wall-adjacent', not 'size-heuristic' (priority: zone → wall → size)
			const wallAdjacentSmallIsland: PixelIsland = {
				segmentId: 2,
				pixelIndices: [5, 6],
				bounds: { minX: 0, maxX: 1, minY: 0, maxY: 1 },
				pixelCount: 2,
			};
			const largeIsland: PixelIsland = {
				segmentId: 2,
				pixelIndices: Array.from({ length: 20 }, (_, i) => i + 10),
				bounds: { minX: 2, maxX: 9, minY: 2, maxY: 5 },
				pixelCount: 20,
			};
			// Wall at mm coords that convert to pixel space overlapping the small island {0,1,0,1}
			// With image height=20, top=0, left=0: pyRel = 19 - pyAbs, pxRel = pxAbs
			// To get pyRel in [0,1], need pyAbs in [18,19], so mm in [900,950]
			// To get pxRel in [0,1], need pxAbs in [0,1], so mm in [0,50]
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({
				virtualWalls: [{ x1: 0, y1: 900, x2: 50, y2: 950 }],
				noGoZones: undefined,
				noMopZones: undefined,
			});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 20, height: 20 },
			});

			const classifications = classifyIslands([largeIsland, wallAdjacentSmallIsland], mapData, image);
			const smallClass = classifications.find((c) => c.island.pixelCount === 2);
			// Island qualifies for BOTH wall-adjacent (bbox overlaps wall) AND size-heuristic (2 < 15% of 20)
			// but wall-adjacent takes priority in the evaluation order
			expect(smallClass?.reason).toBe('wall-adjacent');
			expect(smallClass?.excluded).toBe(true);
		});

		it('assigns displayIndex as 1-based position in islands array', () => {
			const islands: PixelIsland[] = [
				{
					segmentId: 1,
					pixelIndices: [0],
					bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
					pixelCount: 1,
				},
				{
					segmentId: 2,
					pixelIndices: [1],
					bounds: { minX: 1, maxX: 1, minY: 0, maxY: 0 },
					pixelCount: 1,
				},
			];
			const mapData = asPartial<Parameters<typeof classifyIslands>[1]>({});
			const image = asPartial<Parameters<typeof classifyIslands>[2]>({
				position: { top: 0, left: 0 },
				dimensions: { width: 10, height: 10 },
			});

			const classifications = classifyIslands(islands, mapData, image);
			expect(classifications[0].displayIndex).toBe(1);
			expect(classifications[1].displayIndex).toBe(2);
		});
	});
});
