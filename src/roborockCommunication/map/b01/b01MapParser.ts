import crypto from 'node:crypto';
import zlib from 'node:zlib';

import protobuf from 'protobufjs';

import { parseQ10MapPacket } from './b01Q10MapParser.js';
import { ROBOROCK_PROTO_STR } from './roborockProto.js';
import { B01MapInfo, B01Pose, B01RoomInfo, B01RoomMatrix } from './types.js';

export class B01MapParser {
	private readonly robotMapType: protobuf.Type;

	constructor() {
		const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
		this.robotMapType = root.lookupType('SCMap.RobotMap');
	}

	public parseRoomsFromEncryptedBinary(rawBuffer: Buffer, modelShortCode: string, serial: string): B01MapInfo {
		if (this.isQ10ShapedPayload(rawBuffer)) {
			return this.parseQ10Binary(rawBuffer);
		}
		if (this.isQ10TracePayload(rawBuffer)) {
			return { rooms: [], mapId: undefined, currentPose: undefined, roomMatrix: undefined };
		}
		const decoded = this.decodeBase64IfNeeded(rawBuffer);
		const decrypted = this.decryptIfNeeded(decoded, modelShortCode, serial);
		const hexed = this.asciiHexToBinaryIfNeeded(decrypted);
		const decompressed = zlib.inflateSync(hexed);
		return this.parseRooms(decompressed);
	}

	private isQ10ShapedPayload(rawBuffer: Buffer): boolean {
		return rawBuffer.length >= 2 && rawBuffer[0] === 0x01 && rawBuffer[1] === 0x01;
	}

	private isQ10TracePayload(rawBuffer: Buffer): boolean {
		return rawBuffer.length >= 2 && rawBuffer[0] === 0x02 && rawBuffer[1] === 0x01;
	}

	private parseQ10Binary(rawBuffer: Buffer): B01MapInfo {
		try {
			return parseQ10MapPacket(rawBuffer);
		} catch (err) {
			throw new Error(
				`Q10 map binary parse failed (best-effort Q10 layout, unconfirmed against real device capture): ${String(err instanceof Error ? err.message : err)}`,
				{ cause: err },
			);
		}
	}

	private decodeBase64IfNeeded(data: Buffer): Buffer {
		const sample = data.subarray(0, Math.min(data.length, 100)).toString('utf8');
		if (/^[A-Za-z0-9+/= \r\n]+$/.test(sample)) {
			return Buffer.from(data.toString('utf8'), 'base64');
		}
		return data;
	}

	private decryptIfNeeded(data: Buffer, modelShortCode: string, serial: string): Buffer {
		if (data.length % 16 !== 0) return data;
		const key = this.deriveEncryptionKey(modelShortCode, serial);
		const decipher = crypto.createDecipheriv('aes-128-ecb', key, null);
		decipher.setAutoPadding(true);
		return Buffer.concat([decipher.update(data), decipher.final()]);
	}

	private asciiHexToBinaryIfNeeded(data: Buffer): Buffer {
		const sample = data.subarray(0, 10).toString('utf8');
		if (/^[0-9a-fA-F]+$/.test(sample) && sample.startsWith('78')) {
			return Buffer.from(data.toString('utf8'), 'hex');
		}
		return data;
	}

	private deriveEncryptionKey(modelShortCode: string, serial: string): Buffer {
		const baseKey = Buffer.from(modelShortCode.padEnd(16, '0'), 'utf8');
		const data = Buffer.from(`${serial}+${modelShortCode}+${serial}`, 'utf8');
		const padLength = 16 - (data.length % 16);
		const paddedData = Buffer.concat([data, Buffer.alloc(padLength, padLength)]);
		const cipher = crypto.createCipheriv('aes-128-ecb', baseKey, null);
		cipher.setAutoPadding(false);
		const encrypted = Buffer.concat([cipher.update(paddedData), cipher.final()]);
		const hash = crypto.createHash('md5').update(encrypted.toString('base64')).digest('hex');
		return Buffer.from(hash.substring(8, 24).toLowerCase(), 'utf8');
	}

	public parseRooms(buffer: Buffer): B01MapInfo {
		const decoded: Record<string, unknown> = this.robotMapType.decode(buffer) as unknown as Record<string, unknown>;
		const roomDataInfo = decoded.roomDataInfo as Record<string, unknown>[] | undefined;
		const mapHead = decoded.mapHead as Record<string, unknown> | undefined;
		const mapId = typeof mapHead?.mapHeadId === 'number' && mapHead.mapHeadId > 0 ? mapHead.mapHeadId : undefined;

		const currentPoseRaw = decoded.currentPose as Record<string, unknown> | undefined;
		const currentPose: B01Pose | undefined =
			currentPoseRaw && typeof currentPoseRaw.x === 'number' && typeof currentPoseRaw.y === 'number'
				? {
						x: currentPoseRaw.x,
						y: currentPoseRaw.y,
						phi: typeof currentPoseRaw.phi === 'number' ? currentPoseRaw.phi : undefined,
					}
				: undefined;

		const roomMatrixRaw = decoded.roomMatrix as Record<string, unknown> | undefined;
		const matrixBytes = roomMatrixRaw?.matrix;
		const roomMatrix: B01RoomMatrix | undefined =
			Buffer.isBuffer(matrixBytes) && matrixBytes.length > 0 ? { data: matrixBytes } : undefined;

		if (!roomDataInfo || roomDataInfo.length === 0) {
			return { rooms: [], mapId, currentPose, roomMatrix };
		}

		const rooms: B01RoomInfo[] = roomDataInfo.map((r) => {
			const namePost = r.roomNamePost as { x: number; y: number } | undefined;
			return {
				roomId: r.roomId as number,
				roomName: (r.roomName as string) || '',
				roomTypeId: r.roomTypeId as number | undefined,
				colorId: r.colorId as number | undefined,
				labelPos: namePost ? { x: namePost.x, y: namePost.y } : undefined,
			};
		});

		return { rooms, mapId, currentPose, roomMatrix };
	}
}
