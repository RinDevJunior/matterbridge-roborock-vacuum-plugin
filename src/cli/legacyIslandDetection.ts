import { LegacyImageBlock, LegacyMapData } from '../roborockCommunication/map/v1/types.js';

const MM_PER_PIXEL = 50;

/** Accounts for line-thickness/rounding when comparing a wall's endpoint bbox to an island's pixel bbox — a design choice, not a spec value. */
const WALL_TOLERANCE_PX = 3;

/** An island under 30% of the largest same-segment island's pixel count is treated as noise — last-resort fallback, evaluated per-island after zone-overlap/wall-adjacent, regardless of whether wall/zone data exists elsewhere on the map. */
const SIZE_RATIO_THRESHOLD = 0.3;

export interface PixelIsland {
	segmentId: number;
	pixelIndices: number[]; // linear indices into the image's pixel grid
	bounds: { minX: number; maxX: number; minY: number; maxY: number }; // pixel space
	pixelCount: number;
}

export interface IslandClassification {
	displayIndex: number; // 1-based, stable within one CLI run — what --exclude-islands refers to
	island: PixelIsland;
	excluded: boolean;
	reason: 'zone-overlap' | 'wall-adjacent' | 'size-heuristic' | 'kept' | 'manual-override';
}

interface PixelBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

export function findConnectedIslands(segments: number[], width: number, height: number): PixelIsland[] {
	const segmentByIndex = new Map<number, number>();
	for (const packed of segments) {
		segmentByIndex.set(packed & 0x1fffff, packed >> 21);
	}

	const visited = new Set<number>();
	const islands: PixelIsland[] = [];

	for (const [startIndex, segmentId] of segmentByIndex) {
		if (visited.has(startIndex)) continue;

		const pixelIndices: number[] = [];
		const queue: number[] = [startIndex];
		visited.add(startIndex);

		while (queue.length > 0) {
			const index = queue.pop() as number;
			pixelIndices.push(index);

			const x = index % width;
			const y = Math.floor(index / width);
			const neighbors = [
				x > 0 ? index - 1 : -1,
				x < width - 1 ? index + 1 : -1,
				y > 0 ? index - width : -1,
				y < height - 1 ? index + width : -1,
			];

			for (const neighborIndex of neighbors) {
				if (neighborIndex < 0 || visited.has(neighborIndex)) continue;
				if (segmentByIndex.get(neighborIndex) !== segmentId) continue;
				visited.add(neighborIndex);
				queue.push(neighborIndex);
			}
		}

		islands.push({
			segmentId,
			pixelIndices,
			bounds: computeBounds(pixelIndices, width),
			pixelCount: pixelIndices.length,
		});
	}

	islands.sort((a, b) => a.segmentId - b.segmentId || b.pixelCount - a.pixelCount);
	return islands;
}

export function classifyIslands(
	islands: PixelIsland[],
	mapData: Pick<LegacyMapData, 'virtualWalls' | 'noGoZones' | 'noMopZones'>,
	image: Pick<LegacyImageBlock, 'position' | 'dimensions'>,
): IslandClassification[] {
	const zoneBoxes = [...(mapData.noGoZones ?? []), ...(mapData.noMopZones ?? [])].map((zone) =>
		computeBoundsFromPoints(zone.points, image),
	);
	const wallBoxes = (mapData.virtualWalls ?? []).map((wall) => {
		const bbox = computeBoundsFromPoints(
			[
				[wall.x1, wall.y1],
				[wall.x2, wall.y2],
			],
			image,
		);
		return {
			minX: bbox.minX - WALL_TOLERANCE_PX,
			maxX: bbox.maxX + WALL_TOLERANCE_PX,
			minY: bbox.minY - WALL_TOLERANCE_PX,
			maxY: bbox.maxY + WALL_TOLERANCE_PX,
		};
	});

	const largestPixelCountBySegment = new Map<number, number>();
	for (const island of islands) {
		const existing = largestPixelCountBySegment.get(island.segmentId) ?? 0;
		largestPixelCountBySegment.set(island.segmentId, Math.max(existing, island.pixelCount));
	}

	return islands.map((island, i) => {
		const largestPixelCount = largestPixelCountBySegment.get(island.segmentId) ?? island.pixelCount;
		const isLargestForSegment = island.pixelCount === largestPixelCount;

		let reason: IslandClassification['reason'] = 'kept';
		if (zoneBoxes.some((box) => intersects(island.bounds, box))) {
			reason = 'zone-overlap';
		} else if (!isLargestForSegment && wallBoxes.some((box) => intersects(island.bounds, box))) {
			reason = 'wall-adjacent';
		} else if (!isLargestForSegment && island.pixelCount < largestPixelCount * SIZE_RATIO_THRESHOLD) {
			reason = 'size-heuristic';
		}

		return {
			displayIndex: i + 1,
			island,
			excluded: reason !== 'kept',
			reason,
		};
	});
}

export function applyManualExclusions(
	classifications: IslandClassification[],
	manualDisplayIndices: number[],
): IslandClassification[] {
	const manualSet = new Set(manualDisplayIndices);
	return classifications.map((classification) => {
		if (!manualSet.has(classification.displayIndex)) return classification;
		return { ...classification, excluded: true, reason: 'manual-override' };
	});
}

function computeBounds(pixelIndices: number[], width: number): PixelBounds {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const index of pixelIndices) {
		const x = index % width;
		const y = Math.floor(index / width);
		minX = Math.min(minX, x);
		maxX = Math.max(maxX, x);
		minY = Math.min(minY, y);
		maxY = Math.max(maxY, y);
	}
	return { minX, maxX, minY, maxY };
}

function computeBoundsFromPoints(
	points: [number, number][],
	image: Pick<LegacyImageBlock, 'position' | 'dimensions'>,
): PixelBounds {
	let minX = Infinity;
	let maxX = -Infinity;
	let minY = Infinity;
	let maxY = -Infinity;
	for (const [mmX, mmY] of points) {
		const pxAbs = Math.round(mmX / MM_PER_PIXEL);
		const pyAbs = Math.round(mmY / MM_PER_PIXEL);
		const pxRel = pxAbs - image.position.left;
		const pyRel = image.dimensions.height - 1 - (pyAbs - image.position.top);
		minX = Math.min(minX, pxRel);
		maxX = Math.max(maxX, pxRel);
		minY = Math.min(minY, pyRel);
		maxY = Math.max(maxY, pyRel);
	}
	return { minX, maxX, minY, maxY };
}

function intersects(a: PixelBounds, b: PixelBounds): boolean {
	return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}
