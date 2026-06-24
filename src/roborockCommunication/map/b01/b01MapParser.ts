import crypto from 'node:crypto';
import zlib from 'node:zlib';

import protobuf from 'protobufjs';

import { ROBOROCK_PROTO_STR } from './roborockProto.js';
import { B01MapInfo, B01RoomInfo } from './types.js';

export class B01MapParser {
	private readonly robotMapType: protobuf.Type;

	constructor() {
		const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
		this.robotMapType = root.lookupType('SCMap.RobotMap');
	}

	public parseRoomsFromEncryptedBinary(rawBuffer: Buffer, modelShortCode: string, serial: string): B01MapInfo {
		const decoded = this.decodeBase64IfNeeded(rawBuffer);
		const decrypted = this.decryptIfNeeded(decoded, modelShortCode, serial);
		const hexed = this.asciiHexToBinaryIfNeeded(decrypted);
		const decompressed = zlib.inflateSync(hexed);
		return this.parseRooms(decompressed);
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

		if (!roomDataInfo || roomDataInfo.length === 0) {
			return { rooms: [], mapId };
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

		return { rooms, mapId };
	}
}
