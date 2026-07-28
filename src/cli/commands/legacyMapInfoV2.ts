import { writeFileSync } from 'node:fs';

import { AnsiLogger } from 'matterbridge/logger';

import { LegacyMapParser } from '../../roborockCommunication/map/v1/mapParser.js';
import { decryptAndUnzipV1Map } from '../../roborockCommunication/map/v1/v1MapDecryptor.js';
import { Protocol } from '../../roborockCommunication/models/index.js';
import { connectDevice } from '../connection.js';
import {
	extractNamedRooms,
	parseDeviceStatusPush,
	parseMapInfoPush,
	resolveActiveMapId,
	roomDisplayName,
} from '../mapListHelpers.js';
import { CliSession } from '../types.js';
import { waitForPush } from '../waitForPush.js';

interface PixelBounds {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
}

// Self-contained bounding-box computation, intentionally decoupled from the pending
// (unapproved) `bounds` field being considered for `LegacySegmentInfo` in
// workspace/roborock-s8-room-mismatch/ — kept local here to avoid coupling/merge conflicts.
function computeSegmentPixelBounds(packedSegments: number[], width: number): Map<number, PixelBounds> {
	const bounds = new Map<number, PixelBounds>();
	for (const packed of packedSegments) {
		const index = packed & 0x1fffff;
		const segmentId = packed >> 21;
		const x = index % width;
		const y = Math.floor(index / width);
		const existing = bounds.get(segmentId);
		if (!existing) {
			bounds.set(segmentId, { minX: x, maxX: x, minY: y, maxY: y });
		} else {
			existing.minX = Math.min(existing.minX, x);
			existing.maxX = Math.max(existing.maxX, x);
			existing.minY = Math.min(existing.minY, y);
			existing.maxY = Math.max(existing.maxY, y);
		}
	}
	return bounds;
}

// Golden-angle HSL hue distribution for maximally distinct per-segment colors regardless of count.
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const hp = h / 60;
	const x = c * (1 - Math.abs((hp % 2) - 1));
	let r1: number, g1: number, b1: number;
	if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
	else if (hp >= 1 && hp < 2) [r1, g1, b1] = [x, c, 0];
	else if (hp >= 2 && hp < 3) [r1, g1, b1] = [0, c, x];
	else if (hp >= 3 && hp < 4) [r1, g1, b1] = [0, x, c];
	else if (hp >= 4 && hp < 5) [r1, g1, b1] = [x, 0, c];
	else [r1, g1, b1] = [c, 0, x];
	const m = l - c / 2;
	return [Math.round((r1 + m) * 255), Math.round((g1 + m) * 255), Math.round((b1 + m) * 255)];
}

function segmentColor(segmentId: number, cache: Map<number, [number, number, number]>): [number, number, number] {
	const cached = cache.get(segmentId);
	if (cached) return cached;
	const hue = (segmentId * 137.508) % 360;
	const rgb = hslToRgb(hue, 0.7, 0.5);
	cache.set(segmentId, rgb);
	return rgb;
}

interface Island {
	rank: number;
	segmentId: number;
	size: number;
	minRow: number;
	maxRow: number;
	minCol: number;
	maxCol: number;
	centroidRow: number;
	centroidCol: number;
	indices: number[];
}

// 4-connected flood fill over pixels that carry a segmentId (index -> segmentId lookup built
// from image.pixels.segments). Obstacle/floor/blank pixels are never part of this map, so they
// are automatically excluded from the flood fill. Each disconnected group of same-segmentId
// pixels becomes one "island" — this is how a single room segment id spanning multiple
// physically separate pixel regions (e.g. decode/scan noise slivers) gets identified.
function findIslands(segmentBySet: Map<number, number>, width: number, height: number): Island[] {
	const visited = new Set<number>();
	const unranked: Omit<Island, 'rank'>[] = [];

	for (const [startIndex, segmentId] of segmentBySet) {
		if (visited.has(startIndex)) continue;
		visited.add(startIndex);

		const stack: number[] = [startIndex];
		const indices: number[] = [];
		let minRow = Infinity;
		let maxRow = -Infinity;
		let minCol = Infinity;
		let maxCol = -Infinity;

		while (stack.length > 0) {
			const index = stack.pop() as number;
			indices.push(index);
			const row = Math.floor(index / width);
			const col = index % width;
			minRow = Math.min(minRow, row);
			maxRow = Math.max(maxRow, row);
			minCol = Math.min(minCol, col);
			maxCol = Math.max(maxCol, col);

			const neighbors: number[] = [];
			if (row > 0) neighbors.push(index - width);
			if (row < height - 1) neighbors.push(index + width);
			if (col > 0) neighbors.push(index - 1);
			if (col < width - 1) neighbors.push(index + 1);

			for (const neighbor of neighbors) {
				if (visited.has(neighbor)) continue;
				if (segmentBySet.get(neighbor) === segmentId) {
					visited.add(neighbor);
					stack.push(neighbor);
				}
			}
		}

		let sumRow = 0;
		let sumCol = 0;
		for (const index of indices) {
			sumRow += Math.floor(index / width);
			sumCol += index % width;
		}

		unranked.push({
			segmentId,
			size: indices.length,
			minRow,
			maxRow,
			minCol,
			maxCol,
			centroidRow: Math.round(sumRow / indices.length),
			centroidCol: Math.round(sumCol / indices.length),
			indices,
		});
	}

	// Numbering: #1 = largest island found anywhere in the map (any segment). This ranking is
	// specific to this capture and may shift between different captures/runs.
	unranked.sort((a, b) => b.size - a.size);
	return unranked.map((island, i) => ({ ...island, rank: i + 1 }));
}

function islandColor(rank: number, cache: Map<number, [number, number, number]>): [number, number, number] {
	const cached = cache.get(rank);
	if (cached) return cached;
	const hue = (rank * 137.508) % 360;
	const rgb = hslToRgb(hue, 0.7, 0.5);
	cache.set(rank, rgb);
	return rgb;
}

// Standard digital-clock-style 5x7 monospace digit glyphs, top row first, '1' = pixel on.
const FONT: Record<string, string[]> = {
	'0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
	'1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
	'2': ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
	'3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
	'4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
	'5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
	'6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
	'7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
	'8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
	'9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

function drawIslandLabel(
	rgbBuffer: Buffer,
	width: number,
	height: number,
	rank: number,
	centerRow: number,
	centerCol: number,
	textRgb: [number, number, number],
): void {
	const label = String(rank);
	const glyphWidth = 5;
	const glyphHeight = 7;
	const gap = 1;
	const totalWidth = label.length * glyphWidth + (label.length - 1) * gap;
	const startRow = centerRow - Math.floor(glyphHeight / 2);
	const startCol = centerCol - Math.floor(totalWidth / 2);

	for (let i = 0; i < label.length; i++) {
		const glyph = FONT[label[i]];
		if (!glyph) continue;
		const digitStartCol = startCol + i * (glyphWidth + gap);
		for (let row = 0; row < glyphHeight; row++) {
			for (let col = 0; col < glyphWidth; col++) {
				if (glyph[row][col] !== '1') continue;
				const px = digitStartCol + col;
				const py = startRow + row;
				if (px < 0 || px >= width || py < 0 || py >= height) continue;
				const offset = (py * width + px) * 3;
				rgbBuffer[offset] = textRgb[0];
				rgbBuffer[offset + 1] = textRgb[1];
				rgbBuffer[offset + 2] = textRgb[2];
			}
		}
	}
}

function renderGrid(
	width: number,
	height: number,
	obstacleSet: Set<number>,
	segmentBySet: Map<number, number>,
	floorSet: Set<number>,
	colorCache: Map<number, [number, number, number]>,
): { gridLines: string[]; rgbBuffer: Buffer } {
	const gridLines: string[] = [];
	const rgbBuffer = Buffer.alloc(width * height * 3);
	let rgbOffset = 0;

	for (let row = 0; row < height; row++) {
		let line = '';
		for (let col = 0; col < width; col++) {
			const index = row * width + col;
			const isObstacle = obstacleSet.has(index);
			const segmentId = segmentBySet.get(index);

			let char: string;
			let rgb: [number, number, number];
			if (isObstacle) {
				char = '#';
				rgb = [0, 0, 0];
			} else if (segmentId !== undefined) {
				char = segmentId.toString(36);
				rgb = segmentId === 0 ? [200, 200, 200] : segmentColor(segmentId, colorCache);
			} else if (floorSet.has(index)) {
				char = '_';
				rgb = [200, 200, 200];
			} else {
				char = '.';
				rgb = [255, 255, 255];
			}

			line += char;
			rgbBuffer[rgbOffset++] = rgb[0];
			rgbBuffer[rgbOffset++] = rgb[1];
			rgbBuffer[rgbOffset++] = rgb[2];
		}
		gridLines.push(line);
	}

	return { gridLines, rgbBuffer };
}

function writePpm(path: string, width: number, height: number, rgbBuffer: Buffer): void {
	const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
	writeFileSync(path, Buffer.concat([header, rgbBuffer]));
}

export async function cmdLegacyMapInfoV2(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
	excludeIslandsArg?: string,
): Promise<void> {
	const { clientRouter, dispatcher } = await connectDevice(duid, session, logger, local);
	try {
		const mapBinaryPromise = waitForPush(clientRouter, duid, (msg) => {
			const buf = msg.body?.get(Protocol.map_response);
			return Buffer.isBuffer(buf) ? buf : undefined;
		});
		const mapInfoPromise = waitForPush(clientRouter, duid, parseMapInfoPush);
		const statusPromise = waitForPush(clientRouter, duid, parseDeviceStatusPush);

		void dispatcher.getHomeMap(duid);
		void dispatcher.getMapInfo(duid);
		void dispatcher.getDeviceStatus(duid);
		console.log('Waiting for V1 map binary and room metadata...');

		const [rawBuffer, mapResult, statusResult] = await Promise.all([mapBinaryPromise, mapInfoPromise, statusPromise]);

		if (!rawBuffer) {
			console.log('No map binary received within timeout.');
			return;
		}

		const sessionNonce = clientRouter.getSerializeNonce();
		let mapBuffer: Buffer;
		try {
			mapBuffer = decryptAndUnzipV1Map(rawBuffer, sessionNonce);
		} catch (err) {
			console.error('Failed to decrypt V1 map binary:', err instanceof Error ? err.message : String(err));
			return;
		}

		const activeMapId = resolveActiveMapId(statusResult);
		const namedRooms = extractNamedRooms(mapResult, activeMapId);

		const parser = new LegacyMapParser();
		const mapData = parser.parse(mapBuffer);

		console.log('\nRobot position:  ', mapData.robotPosition ?? 'not found');
		console.log('Charger position:', mapData.chargerPosition ?? 'not found');

		const image = mapData.image;
		if (!image) {
			console.log('\nNo image block found in parsed map data.');
			return;
		}

		console.log('\nImage summary:', {
			dimensions: image.dimensions,
			position: image.position,
		});

		const width = image.dimensions.width;
		const height = image.dimensions.height;
		const pixelBounds = computeSegmentPixelBounds(image.pixels.segments, width);

		const pixelCounts = new Map<number, number>();
		for (const packed of image.pixels.segments) {
			const segmentId = packed >> 21;
			pixelCounts.set(segmentId, (pixelCounts.get(segmentId) ?? 0) + 1);
		}

		console.log('\nSegments:');
		console.log(
			'(approxBounds is a rectangle approximation; the exact per-pixel shape for each room is in the .grid.txt/.ppm files below, keyed by gridChar)',
		);
		console.log(
			'(Island numbers below are specific to this capture and may shift between different captures/runs — do not rely on them across map re-scans)',
		);
		for (const seg of image.segments.list) {
			const name = roomDisplayName(seg.id, namedRooms);
			const bounds = pixelBounds.get(seg.id);
			const exactPixelCount = pixelCounts.get(seg.id) ?? 0;
			const gridChar = seg.id.toString(36);
			console.log(
				`  [${seg.id}] ${name || '(unnamed)'}  center=${JSON.stringify(seg.center)}  approxBounds=${bounds ? JSON.stringify(bounds) : 'n/a'}  exactPixelCount=${exactPixelCount}  gridChar='${gridChar}'`,
			);
		}

		if (mapResult && namedRooms.length === 0) {
			console.log('(Room names unavailable — active map unknown or device returned no map list)');
		}

		// Build fast-lookup sets for the single combined pixel scan below.
		const floorSet = new Set(image.pixels.floor);
		const obstacleSet = new Set(image.pixels.obstacle);
		const segmentBySet = new Map<number, number>(); // index -> segmentId
		for (const packed of image.pixels.segments) {
			segmentBySet.set(packed & 0x1fffff, packed >> 21);
		}

		// Connected-component ("island") detection: a single segment id can legitimately span
		// multiple physically disconnected pixel regions (e.g. decode/scan noise slivers that
		// real Roborock users wall off in the app). Number each disconnected region so they can
		// be identified by eye and optionally stripped out via --exclude-islands.
		const islands = findIslands(segmentBySet, width, height);
		const indexToRank = new Map<number, number>();
		for (const island of islands) {
			for (const index of island.indices) {
				indexToRank.set(index, island.rank);
			}
		}

		console.log('\nIslands:');
		console.log(
			'(Ranked by pixel count descending — #1 is the largest disconnected region in this capture, any segment)',
		);
		for (const island of islands) {
			const gridChar = island.segmentId.toString(36);
			console.log(
				`  #${island.rank}  segmentId=${island.segmentId} char='${gridChar}'  size=${island.size}px  rows=${island.minRow}-${island.maxRow}  cols=${island.minCol}-${island.maxCol}`,
			);
		}

		const colorCache = new Map<number, [number, number, number]>();
		const { gridLines, rgbBuffer } = renderGrid(width, height, obstacleSet, segmentBySet, floorSet, colorCache);

		const epochMs = Date.now();
		const gridPath = `legacy-map-v2-${duid}-${epochMs}.grid.txt`;
		const ppmPath = `legacy-map-v2-${duid}-${epochMs}.ppm`;

		writeFileSync(gridPath, gridLines.join('\n') + '\n', 'utf8');
		writePpm(ppmPath, width, height, rgbBuffer);

		console.log('\nWrote text grid to:', gridPath);
		console.log('Wrote PPM image to:', ppmPath);
		console.log(
			'(Note: image is written in raw buffer row order — row 0 is the first stored row, which may appear',
			'vertically flipped or rotated compared to the phone app orientation; expected for this first version.)',
		);

		// Numbered islands PPM: same dimensions, colored per-island (not per-segment) so two
		// disconnected islands sharing a segmentId get visually distinct colors, with the island
		// number drawn at its centroid when its bounding box is large enough to be legible.
		const islandColorCache = new Map<number, [number, number, number]>();
		const islandsRgbBuffer = Buffer.alloc(width * height * 3);
		let islandsOffset = 0;
		for (let row = 0; row < height; row++) {
			for (let col = 0; col < width; col++) {
				const index = row * width + col;
				const isObstacle = obstacleSet.has(index);
				const rank = indexToRank.get(index);

				let rgb: [number, number, number];
				if (isObstacle) {
					rgb = [0, 0, 0];
				} else if (rank !== undefined) {
					rgb = islandColor(rank, islandColorCache);
				} else if (floorSet.has(index)) {
					rgb = [200, 200, 200];
				} else {
					rgb = [255, 255, 255];
				}

				islandsRgbBuffer[islandsOffset++] = rgb[0];
				islandsRgbBuffer[islandsOffset++] = rgb[1];
				islandsRgbBuffer[islandsOffset++] = rgb[2];
			}
		}

		for (const island of islands) {
			const bboxWidth = island.maxCol - island.minCol + 1;
			const bboxHeight = island.maxRow - island.minRow + 1;
			if (bboxWidth < 7 || bboxHeight < 9) continue;

			const bgRgb = islandColor(island.rank, islandColorCache);
			const luminance = 0.299 * bgRgb[0] + 0.587 * bgRgb[1] + 0.114 * bgRgb[2];
			const textRgb: [number, number, number] = luminance > 140 ? [0, 0, 0] : [255, 255, 255];
			drawIslandLabel(islandsRgbBuffer, width, height, island.rank, island.centroidRow, island.centroidCol, textRgb);
		}

		const islandsPpmPath = `legacy-map-v2-${duid}-${epochMs}.islands.ppm`;
		writePpm(islandsPpmPath, width, height, islandsRgbBuffer);
		console.log('Wrote numbered islands PPM image to:', islandsPpmPath);

		// Optional cleanup pass: strip specific numbered islands (identified by eye against the
		// islands PPM / table above) and write cleaned grid/ppm outputs. Skipped entirely when
		// --exclude-islands is not provided — the outputs above are unaffected either way.
		if (excludeIslandsArg) {
			const excludeSet = new Set(
				excludeIslandsArg
					.split(',')
					.map((s) => Number(s.trim()))
					.filter((n) => Number.isFinite(n)),
			);

			const existingRanks = new Set(islands.map((island) => island.rank));
			const missing = [...excludeSet].filter((rank) => !existingRanks.has(rank));

			const cleanedFloorSet = new Set(floorSet);
			const cleanedSegmentBySet = new Map(segmentBySet);
			let removedPixelCount = 0;
			for (const island of islands) {
				if (!excludeSet.has(island.rank)) continue;
				removedPixelCount += island.size;
				for (const index of island.indices) {
					cleanedSegmentBySet.delete(index);
					cleanedFloorSet.delete(index);
				}
			}

			const { gridLines: cleanedGridLines, rgbBuffer: cleanedRgbBuffer } = renderGrid(
				width,
				height,
				obstacleSet,
				cleanedSegmentBySet,
				cleanedFloorSet,
				colorCache,
			);

			const cleanedGridPath = `legacy-map-v2-${duid}-${epochMs}.cleaned.grid.txt`;
			const cleanedPpmPath = `legacy-map-v2-${duid}-${epochMs}.cleaned.ppm`;
			writeFileSync(cleanedGridPath, cleanedGridLines.join('\n') + '\n', 'utf8');
			writePpm(cleanedPpmPath, width, height, cleanedRgbBuffer);

			console.log('\nExcluded islands:', [...excludeSet].sort((a, b) => a - b).join(', '));
			console.log('Total pixels removed:', removedPixelCount);
			if (missing.length > 0) {
				console.log(
					`Warning: island number(s) ${missing.sort((a, b) => a - b).join(', ')} not found in this capture — island numbering is per-run and may not match a different capture.`,
				);
			}
			console.log('Wrote cleaned text grid to:', cleanedGridPath);
			console.log('Wrote cleaned PPM image to:', cleanedPpmPath);
		}
	} finally {
		await clientRouter.disconnect();
	}
}
