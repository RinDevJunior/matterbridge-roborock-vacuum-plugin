import { describe, expect, it } from 'vitest';

import { LegacyMapParser } from '../../../../roborockCommunication/map/v1/mapParser.js';
import { buildGenericBlock, buildLegacyMapBuffer, buildMapHeader, LEGACY_BLOCK_TYPE } from '../../../testUtils.js';

describe('LegacyMapParser', () => {
	describe('parse', () => {
		it('parses a ROBOT_POSITION block into robotPosition', () => {
			const buffer = buildLegacyMapBuffer({ robotPosition: { x: 1000, y: 2000, angle: 90 } });
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.robotPosition).toEqual({ x: 1000, y: 2000, angle: 90 });
		});

		it('parses an IMAGE block with 2 segments and 5 floor pixels each', () => {
			const floor = [
				{ x: 0, y: 0, segId: 1 },
				{ x: 1, y: 0, segId: 1 },
				{ x: 2, y: 0, segId: 1 },
				{ x: 3, y: 0, segId: 1 },
				{ x: 4, y: 0, segId: 1 },
				{ x: 0, y: 1, segId: 2 },
				{ x: 1, y: 1, segId: 2 },
				{ x: 2, y: 1, segId: 2 },
				{ x: 3, y: 1, segId: 2 },
				{ x: 4, y: 1, segId: 2 },
			];
			const buffer = buildLegacyMapBuffer({
				imagePixels: { floor },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);

			expect(result.image?.pixels.floor.length).toBe(10);
			expect(result.image?.pixels.segments.length).toBe(10);
			expect(result.image?.segments.list.length).toBe(2);
			expect(result.image?.segments.list.map((s) => s.id).sort()).toEqual([1, 2]);
		});

		it('parses ROBOT_POSITION x/y beyond the 16-bit range as Int32LE (regression: A187 read them as truncated UInt16LE)', () => {
			const buffer = buildLegacyMapBuffer({ robotPosition: { x: 70000, y: 80000, angle: -92 } });
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.robotPosition).toEqual({ x: 70000, y: 80000, angle: -92 });
		});

		it('parses IMAGE dimensions and position as distinct Int32LE fields (regression: A187 read wrong offsets, yielding width=0)', () => {
			const buffer = buildLegacyMapBuffer({
				imagePixels: { floor: [{ x: 2, y: 3, segId: 1 }] },
				imageSize: { width: 150, height: 200, left: 297, top: 384 },
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.image?.dimensions).toEqual({ width: 150, height: 200 });
			expect(result.image?.position).toEqual({ top: 384, left: 297 });
		});

		it('computes segment center using the image top/left offset (regression: A187 read left as 0 due to wrong offset)', () => {
			const buffer = buildLegacyMapBuffer({
				imagePixels: { floor: [{ x: 5, y: 5, segId: 3 }] },
				imageSize: { width: 20, height: 20, left: 100, top: 50 },
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.image?.segments.list).toEqual([
				{ id: 3, name: '', center: [5250, 2750], boundingBox: { minX: 5, maxX: 5, minY: 5, maxY: 5 } },
			]);
		});

		it('parses a CHARGER_LOCATION block into chargerPosition', () => {
			const buffer = buildLegacyMapBuffer({ chargerPosition: { x: 500, y: 750, angle: 180 } });
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.chargerPosition).toEqual({ x: 500, y: 750, angle: 180 });
			expect(result.robotPosition).toBeUndefined();
		});

		it('parses obstacle pixels into pixels.obstacle without treating them as floor', () => {
			const buffer = buildLegacyMapBuffer({
				imagePixels: {
					floor: [{ x: 0, y: 0, segId: 1 }],
					obstacle: [
						{ x: 1, y: 0 },
						{ x: 2, y: 0 },
					],
				},
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.image?.pixels.obstacle.sort()).toEqual([1, 2]);
			expect(result.image?.pixels.floor).toEqual([0]);
		});

		it('parses a CURRENTLY_CLEANED_BLOCKS block', () => {
			const buffer = buildLegacyMapBuffer({ cleanedBlocks: [1, 3, 5] });
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.currentlyCleanedBlocks).toEqual([1, 3, 5]);
		});

		it('skips unknown block types without throwing and still parses known blocks', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 100, y: 200 },
				unknownBlocks: [buildGenericBlock(99)],
			});
			const parser = new LegacyMapParser();
			expect(() => parser.parse(buffer)).not.toThrow();
			const result = parser.parse(buffer);
			expect(result.robotPosition).toEqual({ x: 100, y: 200, angle: 0 });
		});

		it('returns {} for a buffer shorter than 20 bytes', () => {
			const parser = new LegacyMapParser();
			expect(parser.parse(Buffer.alloc(10))).toEqual({});
		});

		it('returns {} for a 20+ byte buffer missing the "rr" magic', () => {
			const parser = new LegacyMapParser();
			expect(parser.parse(Buffer.alloc(20))).toEqual({});
		});
	});

	describe('resolveCurrentRoom', () => {
		it('returns the segment when the robot sits on one of its pixels', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 250, y: 200 },
				imagePixels: { floor: [{ x: 5, y: 5, segId: 7 }] },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const mapData = parser.parse(buffer);
			expect(parser.resolveCurrentRoom(mapData)).toEqual({ segmentId: 7, name: '' });
		});

		it('returns undefined when the robot position falls outside the image bounds', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 60000, y: 60000 },
				imagePixels: { floor: [{ x: 5, y: 5, segId: 7 }] },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const mapData = parser.parse(buffer);
			expect(parser.resolveCurrentRoom(mapData)).toBeUndefined();
		});

		it('returns undefined when there is no robot position', () => {
			const buffer = buildLegacyMapBuffer({
				imagePixels: { floor: [{ x: 5, y: 5, segId: 7 }] },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const mapData = parser.parse(buffer);
			expect(parser.resolveCurrentRoom(mapData)).toBeUndefined();
		});

		it('falls back to the nearest segment center when the robot is not on any segment pixel', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 60, y: 60 },
				imagePixels: {
					floor: [
						{ x: 1, y: 1, segId: 5 },
						{ x: 9, y: 9, segId: 6 },
					],
				},
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const mapData = parser.parse(buffer);
			expect(parser.resolveCurrentRoom(mapData)).toEqual({ segmentId: 5, name: '' });
		});

		it('resolves the room name from namedRooms', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 250, y: 200 },
				imagePixels: { floor: [{ x: 5, y: 5, segId: 7 }] },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
			});
			const parser = new LegacyMapParser();
			const mapData = parser.parse(buffer);
			expect(parser.resolveCurrentRoom(mapData, [{ id: 7, name: 'Kitchen' }])).toEqual({
				segmentId: 7,
				name: 'Kitchen',
			});
		});

		describe('containment tier (resolveCurrentRoom fallback)', () => {
			it('containment wins over a numerically-closer center (the exact bug scenario)', () => {
				// Segment A: small, at pixels (5-7, 5-8), center at (300, 275)
				// Segment B: larger bbox, center at (225, 450) which is closer to robot than A's center
				// Robot position: pixel (6, 6) which is inside A's bbox but outside B's, not a floor pixel
				// Expected: segment A (via containment), not segment B (which nearest-center alone would pick)
				const buffer = buildLegacyMapBuffer({
					robotPosition: { x: 300, y: 650 },
					imagePixels: {
						floor: [
							// Segment A: small, with gap at (6,6)
							{ x: 5, y: 5, segId: 1 },
							{ x: 6, y: 5, segId: 1 },
							{ x: 7, y: 5, segId: 1 },
							{ x: 5, y: 8, segId: 1 },
							{ x: 6, y: 8, segId: 1 },
							{ x: 7, y: 8, segId: 1 },
							// Segment B: larger, at pixels (4-5, 8-10)
							{ x: 4, y: 8, segId: 2 },
							{ x: 4, y: 9, segId: 2 },
							{ x: 4, y: 10, segId: 2 },
							{ x: 5, y: 8, segId: 2 },
							{ x: 5, y: 9, segId: 2 },
							{ x: 5, y: 10, segId: 2 },
						],
					},
					imageSize: { width: 20, height: 20, left: 0, top: 0 },
				});
				const parser = new LegacyMapParser();
				const mapData = parser.parse(buffer);
				const result = parser.resolveCurrentRoom(mapData);

				// Verify segment B's center is closer in raw distance than segment A's center
				// Segment A center: (300, 275), distance to robot (300, 650) = 375
				// Segment B center: (225, 450), distance to robot (300, 650) ≈ 215.3
				// So nearest-center alone would pick segment B.
				// But robot pixel (6, 6) is inside segment A's bbox {5,7,5,8} and outside segment B's {4,5,8,10}
				// So containment tier picks segment A.
				expect(result).toEqual({ segmentId: 1, name: '' });
			});

			it('ambiguous containment (2+ overlapping bounding boxes) falls through to nearest-center unchanged', () => {
				// Segment A: pixels (5-7, 5-7), center (300, 300)
				// Segment B: pixels (6-8, 6-8), center (350, 350), closer to robot
				// Robot position: pixel (6, 6) which is inside both bboxes (ambiguous)
				// Expected: segment B (which nearest-center would pick), showing containment correctly no-ops on ambiguity
				const buffer = buildLegacyMapBuffer({
					robotPosition: { x: 300, y: 650 },
					imagePixels: {
						floor: [
							// Segment A: pixels (5-7, 5-7), but exclude (6,6)
							{ x: 5, y: 5, segId: 1 },
							{ x: 6, y: 5, segId: 1 },
							{ x: 7, y: 5, segId: 1 },
							{ x: 5, y: 7, segId: 1 },
							{ x: 6, y: 7, segId: 1 },
							{ x: 7, y: 7, segId: 1 },
							// Segment B: pixels (6-8, 6-8), overlapping with A
							{ x: 6, y: 6, segId: 2 },
							{ x: 7, y: 6, segId: 2 },
							{ x: 8, y: 6, segId: 2 },
							{ x: 6, y: 8, segId: 2 },
							{ x: 7, y: 8, segId: 2 },
							{ x: 8, y: 8, segId: 2 },
						],
					},
					imageSize: { width: 20, height: 20, left: 0, top: 0 },
				});
				const parser = new LegacyMapParser();
				const mapData = parser.parse(buffer);
				const result = parser.resolveCurrentRoom(mapData);

				// Both segment A bbox {5,7,5,7} and segment B bbox {6,8,6,8} contain pixel (6,6)
				// Containment tier finds 2 matches (ambiguous), falls back to nearest-center
				// Segment B center (350, 350) is closer to robot (300, 650) than segment A center (300, 300)
				// Distance to A: sqrt((300-300)^2 + (650-300)^2) = 350
				// Distance to B: sqrt((300-350)^2 + (650-350)^2) ≈ 304
				// So nearest-center picks segment B
				expect(result).toEqual({ segmentId: 2, name: '' });
			});

			it('zero containment matches falls through to nearest-center unchanged', () => {
				// Robot position outside all segment bounding boxes
				// Should fall back to nearest-center, which still works correctly
				const buffer = buildLegacyMapBuffer({
					robotPosition: { x: 60, y: 60 },
					imagePixels: {
						floor: [
							// Segment 1: single pixel at (1,1), small bbox
							{ x: 1, y: 1, segId: 1 },
							// Segment 2: single pixel at (9,9), far away
							{ x: 9, y: 9, segId: 2 },
						],
					},
					imageSize: { width: 10, height: 10, left: 0, top: 0 },
				});
				const parser = new LegacyMapParser();
				const mapData = parser.parse(buffer);
				const result = parser.resolveCurrentRoom(mapData);

				// Robot at (60, 60) is at pixel (1, 18) (after Y-flip)
				// Neither bbox {1,1,1,1} nor {9,9,9,9} contains (1, 18)
				// Falls back to nearest-center, which returns segment 1 (closer)
				expect(result).toEqual({ segmentId: 1, name: '' });
			});

			it('exact-pixel match still takes priority over containment (no regression to common case)', () => {
				// Robot on exact floor pixel should return immediately before containment logic runs
				// Even though we have a bounding box now
				const buffer = buildLegacyMapBuffer({
					robotPosition: { x: 250, y: 200 },
					imagePixels: { floor: [{ x: 5, y: 5, segId: 7 }] },
					imageSize: { width: 10, height: 10, left: 0, top: 0 },
				});
				const parser = new LegacyMapParser();
				const mapData = parser.parse(buffer);
				expect(parser.resolveCurrentRoom(mapData)).toEqual({ segmentId: 7, name: '' });
			});

			it('namedRooms resolution still applies through the containment branch', () => {
				// Robot in a gap pixel inside segment bounding box (triggers containment tier, not exact-pixel)
				// Verify namedRooms lookup still works through the containment path
				const buffer = buildLegacyMapBuffer({
					robotPosition: { x: 250, y: 650 },
					imagePixels: {
						floor: [
							// Segment A: pixels with gap at (5,6)
							{ x: 5, y: 5, segId: 1 },
							{ x: 6, y: 5, segId: 1 },
							{ x: 6, y: 6, segId: 1 },
							{ x: 7, y: 6, segId: 1 },
							{ x: 7, y: 7, segId: 1 },
							{ x: 7, y: 5, segId: 1 },
						],
					},
					imageSize: { width: 20, height: 20, left: 0, top: 0 },
				});
				const parser = new LegacyMapParser();
				const mapData = parser.parse(buffer);
				// Robot at (250, 650) maps to pixel (5, 6) which is inside segment A's bbox {5,7,5,7}
				// but not a floor pixel, so containment tier picks segment A
				// namedRooms should resolve the name correctly through this path
				expect(parser.resolveCurrentRoom(mapData, [{ id: 1, name: 'Living Room' }])).toEqual({
					segmentId: 1,
					name: 'Living Room',
				});
			});
		});
	});

	describe('parse — virtual walls / zones', () => {
		it('parses a single VIRTUAL_WALLS (type 10) block with 1 wall into result.virtualWalls', () => {
			const buffer = buildLegacyMapBuffer({
				virtualWalls: [{ x1: 100, y1: 200, x2: 300, y2: 400 }],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.virtualWalls).toEqual([{ x1: 100, y1: 200, x2: 300, y2: 400 }]);
		});

		it('parses a VIRTUAL_WALLS block with 2 walls — confirms per-entry stride advances correctly', () => {
			const buffer = buildLegacyMapBuffer({
				virtualWalls: [
					{ x1: 100, y1: 200, x2: 300, y2: 400 },
					{ x1: 500, y1: 600, x2: 700, y2: 800 },
				],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.virtualWalls).toEqual([
				{ x1: 100, y1: 200, x2: 300, y2: 400 },
				{ x1: 500, y1: 600, x2: 700, y2: 800 },
			]);
		});

		it('parses a FORBIDDEN_ZONES (type 9) block with 1 zone into result.noGoZones', () => {
			const buffer = buildLegacyMapBuffer({
				noGoZones: [
					[
						[100, 200],
						[300, 200],
						[300, 400],
						[100, 400],
					],
				],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.noGoZones).toEqual([
				{
					points: [
						[100, 200],
						[300, 200],
						[300, 400],
						[100, 400],
					],
				},
			]);
		});

		it('parses a NO_MOP_ZONE (type 12) block into result.noMopZones with correct type dispatch', () => {
			const buffer = buildLegacyMapBuffer({
				noMopZones: [
					[
						[500, 600],
						[700, 600],
						[700, 800],
						[500, 800],
					],
				],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.noMopZones).toEqual([
				{
					points: [
						[500, 600],
						[700, 600],
						[700, 800],
						[500, 800],
					],
				},
			]);
			expect(result.noGoZones).toBeUndefined();
		});

		it('parses a FORBIDDEN_ZONES block with 2 zones — confirms 16-byte-per-entry stride advances correctly', () => {
			const buffer = buildLegacyMapBuffer({
				noGoZones: [
					[
						[100, 200],
						[300, 200],
						[300, 400],
						[100, 400],
					],
					[
						[500, 600],
						[700, 600],
						[700, 800],
						[500, 800],
					],
				],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.noGoZones).toEqual([
				{
					points: [
						[100, 200],
						[300, 200],
						[300, 400],
						[100, 400],
					],
				},
				{
					points: [
						[500, 600],
						[700, 600],
						[700, 800],
						[500, 800],
					],
				},
			]);
		});

		it('handles truncated zone block — drops partial entries, returns only full-fit entries', () => {
			// Build a zone block manually to simulate truncation mid-entry
			const hlength = 8;
			const truncatedBlock = Buffer.alloc(hlength + 24); // count=2 but only room for 1.5 zones (1 full + 8 bytes)
			truncatedBlock.writeUInt16LE(LEGACY_BLOCK_TYPE.FORBIDDEN_ZONES, 0);
			truncatedBlock.writeUInt16LE(hlength, 2);
			truncatedBlock.writeUInt32LE(8, 4); // dataLength: only 8 bytes
			truncatedBlock.writeUInt32LE(2, 0x08); // count=2 but buffer too small
			// Write one full zone (16 bytes): corners at (100,200), (300,200), (300,400), (100,400)
			truncatedBlock.writeUInt16LE(100, hlength);
			truncatedBlock.writeUInt16LE(200, hlength + 2);
			truncatedBlock.writeUInt16LE(300, hlength + 4);
			truncatedBlock.writeUInt16LE(200, hlength + 6);
			truncatedBlock.writeUInt16LE(300, hlength + 8);
			truncatedBlock.writeUInt16LE(400, hlength + 10);
			truncatedBlock.writeUInt16LE(100, hlength + 12);
			truncatedBlock.writeUInt16LE(400, hlength + 14);
			// Only 8 more bytes, not enough for second zone
			truncatedBlock.writeUInt16LE(500, hlength + 16);
			truncatedBlock.writeUInt16LE(600, hlength + 18);
			truncatedBlock.writeUInt16LE(700, hlength + 20);
			truncatedBlock.writeUInt16LE(600, hlength + 22);

			const header = buildMapHeader(truncatedBlock.length);
			const buffer = Buffer.concat([header, truncatedBlock]);

			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			// Should parse only the one complete zone, not throw
			expect(result.noGoZones).toEqual([
				{
					points: [
						[100, 200],
						[300, 200],
						[300, 400],
						[100, 400],
					],
				},
			]);
		});

		it('parses a buffer with VIRTUAL_WALLS + ROBOT_POSITION + IMAGE blocks without disturbing existing block parsing', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 1000, y: 2000 },
				imagePixels: { floor: [{ x: 5, y: 5, segId: 3 }] },
				imageSize: { width: 10, height: 10, left: 0, top: 0 },
				virtualWalls: [{ x1: 100, y1: 200, x2: 300, y2: 400 }],
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.robotPosition).toEqual({ x: 1000, y: 2000, angle: 0 });
			expect(result.image?.pixels.segments.length).toBe(1);
			expect(result.virtualWalls).toEqual([{ x1: 100, y1: 200, x2: 300, y2: 400 }]);
		});

		it('returns undefined for virtualWalls, noGoZones, noMopZones when none of types 9/10/12 are present', () => {
			const buffer = buildLegacyMapBuffer({
				robotPosition: { x: 100, y: 200 },
			});
			const parser = new LegacyMapParser();
			const result = parser.parse(buffer);
			expect(result.virtualWalls).toBeUndefined();
			expect(result.noGoZones).toBeUndefined();
			expect(result.noMopZones).toBeUndefined();
		});
	});
});
