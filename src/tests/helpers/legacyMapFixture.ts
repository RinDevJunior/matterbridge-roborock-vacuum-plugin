import crypto from 'node:crypto';
import zlib from 'node:zlib';

/**
 * Programmatic builders for legacy V1 "rr" map binary frames, used by LegacyMapParser tests.
 * No live device or captured sample is required — every buffer is constructed byte-by-byte.
 */

export const LEGACY_BLOCK_TYPE = {
	CHARGER_LOCATION: 1,
	IMAGE: 2,
	ROBOT_POSITION: 8,
	FORBIDDEN_ZONES: 9,
	VIRTUAL_WALLS: 10,
	CURRENTLY_CLEANED_BLOCKS: 11,
	NO_MOP_ZONE: 12,
} as const;

export interface LegacyMapFixtureOptions {
	robotPosition?: { x: number; y: number; angle?: number };
	chargerPosition?: { x: number; y: number; angle?: number };
	imagePixels?: {
		floor?: { x: number; y: number; segId: number }[];
		obstacle?: { x: number; y: number }[];
	};
	imageSize?: { width: number; height: number; left: number; top: number };
	cleanedBlocks?: number[];
	virtualWalls?: { x1: number; y1: number; x2: number; y2: number }[];
	noGoZones?: [number, number][][];
	noMopZones?: [number, number][][];
	/** Raw pre-built blocks (e.g. from {@link buildGenericBlock}) inserted after the known blocks. */
	unknownBlocks?: Buffer[];
}

/** Writes the 20-byte "rr" header. SHA1 digest is intentionally omitted — LegacyMapParser does not verify it. */
export function buildMapHeader(dataLength: number, headerLength = 20): Buffer {
	const buffer = Buffer.alloc(headerLength);
	buffer.writeUInt8(0x72, 0);
	buffer.writeUInt8(0x72, 1);
	buffer.writeUInt16LE(headerLength, 0x02);
	buffer.writeUInt32LE(dataLength, 0x04);
	return buffer;
}

export function buildPositionBlock(type: number, x: number, y: number, angle?: number): Buffer {
	const hlength = 8;
	const payloadLength = angle !== undefined ? 12 : 8;
	const buffer = Buffer.alloc(hlength + payloadLength);
	buffer.writeUInt16LE(type, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(payloadLength, 4);
	buffer.writeInt32LE(x, hlength);
	buffer.writeInt32LE(y, hlength + 4);
	if (angle !== undefined) {
		buffer.writeInt32LE(angle, hlength + 8);
	}
	return buffer;
}

export function buildImageBlock(
	pixels: { floor?: { x: number; y: number; segId: number }[]; obstacle?: { x: number; y: number }[] },
	size: { width: number; height: number; left: number; top: number },
): Buffer {
	const hlength = 0x1c; // 28 bytes; > 24 so segment count field is included, per LegacyMapParser.parseImageBlock
	const { width, height, left, top } = size;
	const payloadLength = width * height;
	const buffer = Buffer.alloc(hlength + payloadLength);

	const floor = pixels.floor ?? [];
	const obstacle = pixels.obstacle ?? [];
	const segmentIds = new Set(floor.map((p) => p.segId));

	buffer.writeUInt16LE(LEGACY_BLOCK_TYPE.IMAGE, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(payloadLength, 4);
	buffer.writeUInt32LE(segmentIds.size, 0x08);
	buffer.writeInt32LE(top, 0x0c);
	buffer.writeInt32LE(left, 0x10);
	buffer.writeInt32LE(height, 0x14);
	buffer.writeInt32LE(width, 0x18);

	for (const p of obstacle) {
		const index = p.y * width + p.x;
		buffer.writeUInt8(0x01, hlength + index); // pixelType 1 = obstacle
	}
	for (const p of floor) {
		const index = p.y * width + p.x;
		const byte = 0x02 | (p.segId << 3); // pixelType 2 (any non-0/non-1) = floor; bits 7:3 = segment ID
		buffer.writeUInt8(byte, hlength + index);
	}

	return buffer;
}

export function buildCleanedBlocksBlock(segmentIds: number[]): Buffer {
	const headerBase = 0x0c;
	const hlength = headerBase + segmentIds.length;
	const buffer = Buffer.alloc(hlength);
	buffer.writeUInt16LE(LEGACY_BLOCK_TYPE.CURRENTLY_CLEANED_BLOCKS, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(0, 4);
	buffer.writeUInt16LE(segmentIds.length, 0x08);
	segmentIds.forEach((id, i) => buffer.writeUInt8(id, headerBase + i));
	return buffer;
}

export function buildWallBlock(walls: { x1: number; y1: number; x2: number; y2: number }[]): Buffer {
	const hlength = 8;
	const payloadLength = walls.length * 8;
	const buffer = Buffer.alloc(hlength + payloadLength);
	buffer.writeUInt16LE(LEGACY_BLOCK_TYPE.VIRTUAL_WALLS, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(payloadLength, 4);
	buffer.writeUInt32LE(walls.length, 0x08);
	walls.forEach((wall, i) => {
		const offset = hlength + i * 8;
		buffer.writeUInt16LE(wall.x1, offset);
		buffer.writeUInt16LE(wall.y1, offset + 2);
		buffer.writeUInt16LE(wall.x2, offset + 4);
		buffer.writeUInt16LE(wall.y2, offset + 6);
	});
	return buffer;
}

export function buildZoneBlock(type: number, zones: [number, number][][]): Buffer {
	const hlength = 8;
	const payloadLength = zones.length * 16;
	const buffer = Buffer.alloc(hlength + payloadLength);
	buffer.writeUInt16LE(type, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(payloadLength, 4);
	buffer.writeUInt32LE(zones.length, 0x08);
	zones.forEach((zone, i) => {
		const zoneOffset = hlength + i * 16;
		zone.forEach(([x, y], corner) => {
			const cornerOffset = zoneOffset + corner * 4;
			buffer.writeUInt16LE(x, cornerOffset);
			buffer.writeUInt16LE(y, cornerOffset + 2);
		});
	});
	return buffer;
}

/** Builds a raw block of an arbitrary (non-parsed) type, to verify unknown blocks are skipped without error. */
export function buildGenericBlock(type: number, payloadLength = 4): Buffer {
	const hlength = 8;
	const buffer = Buffer.alloc(hlength + payloadLength);
	buffer.writeUInt16LE(type, 0);
	buffer.writeUInt16LE(hlength, 2);
	buffer.writeUInt32LE(payloadLength, 4);
	return buffer;
}

/** Builds a minimal valid V1 "rr" map binary with the requested blocks. */
export function buildLegacyMapBuffer(options: LegacyMapFixtureOptions): Buffer {
	const blocks: Buffer[] = [];

	if (options.robotPosition) {
		blocks.push(
			buildPositionBlock(
				LEGACY_BLOCK_TYPE.ROBOT_POSITION,
				options.robotPosition.x,
				options.robotPosition.y,
				options.robotPosition.angle,
			),
		);
	}
	if (options.chargerPosition) {
		blocks.push(
			buildPositionBlock(
				LEGACY_BLOCK_TYPE.CHARGER_LOCATION,
				options.chargerPosition.x,
				options.chargerPosition.y,
				options.chargerPosition.angle,
			),
		);
	}
	if (options.imagePixels) {
		const size = options.imageSize ?? { width: 10, height: 10, left: 0, top: 0 };
		blocks.push(buildImageBlock(options.imagePixels, size));
	}
	if (options.cleanedBlocks) {
		blocks.push(buildCleanedBlocksBlock(options.cleanedBlocks));
	}
	if (options.virtualWalls) {
		blocks.push(buildWallBlock(options.virtualWalls));
	}
	if (options.noGoZones) {
		blocks.push(buildZoneBlock(LEGACY_BLOCK_TYPE.FORBIDDEN_ZONES, options.noGoZones));
	}
	if (options.noMopZones) {
		blocks.push(buildZoneBlock(LEGACY_BLOCK_TYPE.NO_MOP_ZONE, options.noMopZones));
	}
	if (options.unknownBlocks) {
		blocks.push(...options.unknownBlocks);
	}

	const dataBuffer = Buffer.concat(blocks);
	const header = buildMapHeader(dataBuffer.length);
	return Buffer.concat([header, dataBuffer]);
}

/**
 * Builds the inner-encrypted V1 map push payload as sent on Protocol 301: gzip-compress the
 * "rr" binary, AES-128-CBC encrypt (key=sessionNonce, IV=zeros), then prepend a 24-byte envelope.
 * Mirrors the device's wire format so decryptAndUnzipV1Map can round-trip it in tests.
 */
export function buildEncryptedV1MapPayload(rrBinary: Buffer, sessionNonce: Buffer): Buffer {
	const gzipped = zlib.gzipSync(rrBinary);
	const iv = Buffer.alloc(16, 0);
	const cipher = crypto.createCipheriv('aes-128-cbc', sessionNonce, iv);
	const encrypted = Buffer.concat([cipher.update(gzipped), cipher.final()]);
	const envelope = Buffer.alloc(24, 0);
	return Buffer.concat([envelope, encrypted]);
}
