import { describe, expect, it } from 'vitest';

import { LegacyMapParser } from '../../../../roborockCommunication/map/v1/mapParser.js';
import type { LegacyMapData } from '../../../../roborockCommunication/map/v1/types.js';
import { buildImageBlock, buildLegacyMapBuffer, buildMapHeader } from '../../../helpers/testUtils.js';

const IMAGE_TYPE = 2;
const IMAGE_HEADER_LENGTH_NO_COUNT = 24;

function buildImageBlockWithHeaderLength24(segmentCountField: number): Buffer {
	const pixelLength = 4;
	const block = Buffer.alloc(IMAGE_HEADER_LENGTH_NO_COUNT + pixelLength);
	block.writeUInt16LE(IMAGE_TYPE, 0);
	block.writeUInt16LE(IMAGE_HEADER_LENGTH_NO_COUNT, 2);
	block.writeUInt32LE(pixelLength, 4);
	// Offset 0x08 is the segment count field; it must be ignored when header length is <= 24.
	block.writeUInt32LE(segmentCountField, 0x08);
	block.writeInt32LE(0, 0x0c); // top
	block.writeInt32LE(0, 0x10); // left
	block.writeInt32LE(0, 0x14); // height
	return block;
}

function buildEmptyImageMapData(): LegacyMapData {
	return {
		robotPosition: { x: 0, y: 0, angle: 0 },
		image: {
			position: { top: 0, left: 0 },
			dimensions: { width: 10, height: 10 },
			pixels: { floor: [], obstacle: [], segments: [] },
			segments: { count: 0, list: [] },
		},
	};
}

describe('LegacyMapParser (gap coverage)', () => {
	describe('parse', () => {
		it('should stop parsing without throwing when fewer than 8 bytes remain at a block boundary', () => {
			// Arrange: header declares 10 data bytes but only 4 follow the header
			const parser = new LegacyMapParser();
			const buffer = Buffer.concat([buildMapHeader(10), Buffer.alloc(4)]);

			// Act
			const result = parser.parse(buffer);

			// Assert
			expect(result).toEqual({});
		});

		it('should report zero segments when image block header length is 24 or less', () => {
			// Arrange: segment count field holds 7, but header length 24 must disable reading it
			const parser = new LegacyMapParser();
			const block = buildImageBlockWithHeaderLength24(7);
			const buffer = Buffer.concat([buildMapHeader(block.length), block]);

			// Act
			const result = parser.parse(buffer);

			// Assert
			expect(result.image?.segments.count).toBe(0);
		});

		it('should skip floor pixels whose segment id is 0', () => {
			// Arrange: one floor pixel with segment id 0
			const parser = new LegacyMapParser();
			const buffer = buildLegacyMapBuffer({
				imagePixels: { floor: [{ x: 0, y: 0, segId: 0 }] },
				imageSize: { width: 1, height: 1, left: 0, top: 0 },
			});

			// Act
			const result = parser.parse(buffer);

			// Assert
			expect(result.image?.segments.list).toEqual([]);
			expect(result.image?.pixels.segments).toEqual([]);
			expect(result.image?.pixels.floor).toEqual([0]);
		});

		it('should keep a segment with a bounding box when the image block has a non-zero segment id', () => {
			// Arrange: same single pixel but with segment id 5
			const parser = new LegacyMapParser();
			const block = buildImageBlock({ floor: [{ x: 0, y: 0, segId: 5 }] }, { width: 1, height: 1, left: 0, top: 0 });
			const buffer = Buffer.concat([buildMapHeader(block.length), block]);

			// Act
			const result = parser.parse(buffer);

			// Assert
			expect(result.image?.segments.list.map((s) => s.id)).toEqual([5]);
		});
	});

	describe('resolveCurrentRoom', () => {
		it('should return undefined when the segment list is empty and no pixel matches', () => {
			// Arrange
			const parser = new LegacyMapParser();
			const data = buildEmptyImageMapData();

			// Act
			const result = parser.resolveCurrentRoom(data);

			// Assert
			expect(result).toBeUndefined();
		});

		it('should return undefined when every segment center is NaN and nothing contains the robot', () => {
			// Arrange: bounding box far away from the robot pixel, centers unusable for distance
			const parser = new LegacyMapParser();
			const data = buildEmptyImageMapData();
			data.image = {
				position: { top: 0, left: 0 },
				dimensions: { width: 10, height: 10 },
				pixels: { floor: [], obstacle: [], segments: [] },
				segments: {
					count: 1,
					list: [
						{
							id: 3,
							name: '',
							center: [Number.NaN, Number.NaN],
							boundingBox: { minX: 100, maxX: 101, minY: 100, maxY: 101 },
						},
					],
				},
			};

			// Act
			const result = parser.resolveCurrentRoom(data);

			// Assert
			expect(result).toBeUndefined();
		});
	});
});
