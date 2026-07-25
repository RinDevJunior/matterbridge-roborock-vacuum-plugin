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

export async function cmdLegacyMapInfoV2(
	duid: string,
	session: CliSession,
	logger: AnsiLogger,
	local = false,
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

		const gridLines: string[] = [];
		const colorCache = new Map<number, [number, number, number]>();
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

		const epochMs = Date.now();
		const gridPath = `legacy-map-v2-${duid}-${epochMs}.grid.txt`;
		const ppmPath = `legacy-map-v2-${duid}-${epochMs}.ppm`;

		writeFileSync(gridPath, gridLines.join('\n') + '\n', 'utf8');

		const ppmHeader = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
		writeFileSync(ppmPath, Buffer.concat([ppmHeader, rgbBuffer]));

		console.log('\nWrote text grid to:', gridPath);
		console.log('Wrote PPM image to:', ppmPath);
		console.log(
			'(Note: image is written in raw buffer row order — row 0 is the first stored row, which may appear',
			'vertically flipped or rotated compared to the phone app orientation; expected for this first version.)',
		);
	} finally {
		await clientRouter.disconnect();
	}
}
