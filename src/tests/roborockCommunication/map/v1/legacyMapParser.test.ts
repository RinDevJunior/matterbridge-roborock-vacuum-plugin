import { describe, expect, it } from 'vitest';

import { LegacyMapParser } from '../../../../roborockCommunication/map/v1/mapParser.js';
import { buildGenericBlock, buildLegacyMapBuffer } from '../../../testUtils.js';

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
			expect(result.image?.segments.list).toEqual([{ id: 3, name: '', center: [5250, 2750] }]);
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
	});
});
