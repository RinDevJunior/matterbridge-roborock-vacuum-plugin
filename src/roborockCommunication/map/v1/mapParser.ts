import {
	LegacyImageBlock,
	LegacyMapData,
	LegacyRobotPosition,
	LegacySegmentInfo,
	LegacyWallLine,
	LegacyZoneQuad,
} from './types.js';

const MM_PER_PIXEL = 50;

const BLOCK_TYPE = {
	CHARGER_LOCATION: 1,
	IMAGE: 2,
	ROBOT_POSITION: 8,
	FORBIDDEN_ZONES: 9,
	VIRTUAL_WALLS: 10,
	CURRENTLY_CLEANED_BLOCKS: 11,
	NO_MOP_ZONE: 12,
} as const;

interface SegmentBoundingBox {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export interface LegacyNamedRoom {
	id: number;
	name: string;
}

export interface LegacyResolvedRoom {
	segmentId: number;
	name: string;
}

export class LegacyMapParser {
	public parse(buffer: Buffer): LegacyMapData {
		if (buffer.length < 20 || buffer[0] !== 0x72 || buffer[1] !== 0x72) return {};

		const headerLength = buffer.readUInt16LE(0x02);
		const dataLength = buffer.readUInt32LE(0x04);
		const dataEnd = headerLength + dataLength;

		const result: LegacyMapData = {};
		let dataPosition = headerLength;

		while (dataPosition < dataEnd) {
			if (dataPosition + 8 > buffer.length) break;

			const type = buffer.readUInt16LE(dataPosition);
			const blockHLength = buffer.readUInt16LE(dataPosition + 2);
			const blockDataLength = buffer.readUInt32LE(dataPosition + 4);

			if (dataPosition + blockHLength + blockDataLength > buffer.length) break;

			switch (type) {
				case BLOCK_TYPE.ROBOT_POSITION:
					result.robotPosition = this.parsePositionBlock(buffer, dataPosition, blockHLength, blockDataLength);
					break;
				case BLOCK_TYPE.CHARGER_LOCATION:
					result.chargerPosition = this.parsePositionBlock(buffer, dataPosition, blockHLength, blockDataLength);
					break;
				case BLOCK_TYPE.IMAGE:
					result.image = this.parseImageBlock(buffer, dataPosition, blockHLength, blockDataLength);
					break;
				case BLOCK_TYPE.CURRENTLY_CLEANED_BLOCKS:
					result.currentlyCleanedBlocks = this.parseCleanedBlocks(buffer, dataPosition);
					break;
				case BLOCK_TYPE.VIRTUAL_WALLS:
					result.virtualWalls = this.parseWallLines(buffer, dataPosition, blockHLength);
					break;
				case BLOCK_TYPE.FORBIDDEN_ZONES:
					result.noGoZones = this.parseZoneQuads(buffer, dataPosition, blockHLength);
					break;
				case BLOCK_TYPE.NO_MOP_ZONE:
					result.noMopZones = this.parseZoneQuads(buffer, dataPosition, blockHLength);
					break;
				default:
					break;
			}

			dataPosition += blockHLength + blockDataLength;
		}

		return result;
	}

	public resolveCurrentRoom(data: LegacyMapData, namedRooms?: LegacyNamedRoom[]): LegacyResolvedRoom | undefined {
		if (!data.robotPosition || !data.image) return undefined;

		const { x, y } = data.robotPosition;
		const {
			position: { top, left },
			dimensions: { width, height },
			pixels: { segments },
		} = data.image;

		const pxAbs = Math.round(x / MM_PER_PIXEL);
		const pyAbs = Math.round(y / MM_PER_PIXEL);
		const pxRel = pxAbs - left;
		const pyRel = height - 1 - (pyAbs - top);

		if (pxRel < 0 || pxRel >= width || pyRel < 0 || pyRel >= height) return undefined;
		const targetIndex = pyRel * width + pxRel;

		for (const packed of segments) {
			if ((packed & 0x1fffff) === targetIndex) {
				const segmentId = packed >> 21;
				const name = namedRooms?.find((r) => r.id === segmentId)?.name ?? '';
				return { segmentId, name };
			}
		}

		const containing = this.findContainingSegment(pxRel, pyRel, data.image.segments.list);
		if (containing) {
			const name = namedRooms?.find((r) => r.id === containing.id)?.name ?? containing.name;
			return { segmentId: containing.id, name };
		}

		return this.findNearestSegment(data.image.segments.list, x, y, namedRooms);
	}

	private parsePositionBlock(
		buffer: Buffer,
		dataPosition: number,
		hlength: number,
		length: number,
	): LegacyRobotPosition {
		const payloadStart = dataPosition + hlength;
		const x = buffer.readInt32LE(payloadStart);
		const y = buffer.readInt32LE(payloadStart + 4);
		const angle = length >= 12 ? buffer.readInt32LE(payloadStart + 8) : 0;
		return { x, y, angle };
	}

	private parseImageBlock(buffer: Buffer, dataPosition: number, hlength: number, length: number): LegacyImageBlock {
		const segmentCount = hlength > 24 ? buffer.readUInt32LE(dataPosition + 0x08) : 0;
		const top = buffer.readInt32LE(dataPosition + 0x0c);
		const left = buffer.readInt32LE(dataPosition + 0x10);
		const height = buffer.readInt32LE(dataPosition + 0x14);
		const width = buffer.readInt32LE(dataPosition + 0x18);
		const pixelStart = dataPosition + hlength;

		const floor: number[] = [];
		const obstacle: number[] = [];
		const segments: number[] = [];
		const segmentBoundingBoxes = new Map<number, SegmentBoundingBox>();
		const segmentIdsSeen = new Set<number>();

		for (let i = 0; i < length; i++) {
			const byte = buffer.readUInt8(pixelStart + i);
			const pixelType = byte & 0x07; // bits 2:0

			if (pixelType === 1) {
				obstacle.push(i);
				continue;
			}
			if (pixelType === 0) continue;

			floor.push(i);
			const segmentId = (byte & 0xf8) >> 3; // bits 7:3
			if (segmentId === 0) continue;

			segmentIdsSeen.add(segmentId);
			segments.push(i | (segmentId << 21));
			this.updateBoundingBox(segmentBoundingBoxes, segmentId, i % width, Math.floor(i / width));
		}

		const list: LegacySegmentInfo[] = [...segmentIdsSeen].map((segmentId) => {
			const bb = segmentBoundingBoxes.get(segmentId);
			const centerX = bb ? Math.round(((bb.minX + bb.maxX) / 2 + left) * MM_PER_PIXEL) : 0;
			const centerY = bb ? Math.round(((bb.minY + bb.maxY) / 2 + top) * MM_PER_PIXEL) : 0;
			const boundingBox = bb
				? { minX: bb.minX, maxX: bb.maxX, minY: bb.minY, maxY: bb.maxY }
				: { minX: 0, maxX: -1, minY: 0, maxY: -1 };
			return { id: segmentId, name: '', center: [centerX, centerY], boundingBox };
		});

		return {
			position: { top, left },
			dimensions: { width, height },
			pixels: { floor, obstacle, segments },
			segments: { count: segmentCount, list },
		};
	}

	private parseCleanedBlocks(buffer: Buffer, dataPosition: number): number[] {
		const count = buffer.readUInt16LE(dataPosition + 0x08);
		const blocks: number[] = [];
		for (let i = 0; i < count; i++) {
			blocks.push(buffer.readUInt8(dataPosition + 0x0c + i));
		}
		return blocks;
	}

	private parseWallLines(buffer: Buffer, dataPosition: number, hlength: number): LegacyWallLine[] {
		const count = buffer.readUInt32LE(dataPosition + 0x08);
		const entriesStart = dataPosition + hlength;
		const walls: LegacyWallLine[] = [];
		for (let i = 0; i < count; i++) {
			const entryOffset = entriesStart + i * 8;
			if (entryOffset + 8 > buffer.length) break;
			walls.push({
				x1: buffer.readUInt16LE(entryOffset),
				y1: buffer.readUInt16LE(entryOffset + 2),
				x2: buffer.readUInt16LE(entryOffset + 4),
				y2: buffer.readUInt16LE(entryOffset + 6),
			});
		}
		return walls;
	}

	private parseZoneQuads(buffer: Buffer, dataPosition: number, hlength: number): LegacyZoneQuad[] {
		const count = buffer.readUInt32LE(dataPosition + 0x08);
		const entriesStart = dataPosition + hlength;
		const zones: LegacyZoneQuad[] = [];
		for (let i = 0; i < count; i++) {
			const entryOffset = entriesStart + i * 16;
			if (entryOffset + 16 > buffer.length) break;
			const points: [number, number][] = [];
			for (let corner = 0; corner < 4; corner++) {
				const pointOffset = entryOffset + corner * 4;
				points.push([buffer.readUInt16LE(pointOffset), buffer.readUInt16LE(pointOffset + 2)]);
			}
			zones.push({ points });
		}
		return zones;
	}

	private updateBoundingBox(map: Map<number, SegmentBoundingBox>, segmentId: number, px: number, py: number): void {
		const existing = map.get(segmentId);
		if (!existing) {
			map.set(segmentId, { minX: px, maxX: px, minY: py, maxY: py });
			return;
		}
		existing.minX = Math.min(existing.minX, px);
		existing.maxX = Math.max(existing.maxX, px);
		existing.minY = Math.min(existing.minY, py);
		existing.maxY = Math.max(existing.maxY, py);
	}

	private findContainingSegment(
		pxRel: number,
		pyRel: number,
		list: LegacySegmentInfo[],
	): LegacySegmentInfo | undefined {
		const matches = list.filter((segment) => {
			const { minX, maxX, minY, maxY } = segment.boundingBox;
			return pxRel >= minX && pxRel <= maxX && pyRel >= minY && pyRel <= maxY;
		});
		return matches.length === 1 ? matches[0] : undefined;
	}

	private findNearestSegment(
		list: LegacySegmentInfo[],
		x: number,
		y: number,
		namedRooms?: LegacyNamedRoom[],
	): LegacyResolvedRoom | undefined {
		if (list.length === 0) return undefined;

		let closest: LegacySegmentInfo | undefined;
		let closestDistance = Infinity;
		for (const segment of list) {
			const [centerX, centerY] = segment.center;
			const distance = Math.hypot(centerX - x, centerY - y);
			if (distance < closestDistance) {
				closestDistance = distance;
				closest = segment;
			}
		}

		if (!closest) return undefined;
		const name = namedRooms?.find((r) => r.id === closest.id)?.name ?? closest.name;
		return { segmentId: closest.id, name };
	}
}
