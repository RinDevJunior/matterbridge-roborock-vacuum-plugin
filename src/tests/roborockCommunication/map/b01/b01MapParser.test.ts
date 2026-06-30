import crypto from 'node:crypto';
import zlib from 'node:zlib';

import * as protobuf from 'protobufjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { B01MapParser } from '../../../../roborockCommunication/map/b01/b01MapParser.js';
import { ROBOROCK_PROTO_STR } from '../../../../roborockCommunication/map/b01/roborockProto.js';

function encodeRobotMap(fields: Record<string, unknown>): Buffer {
	const root = protobuf.parse(ROBOROCK_PROTO_STR).root;
	const robotMapType = root.lookupType('SCMap.RobotMap');
	const message = robotMapType.create(fields);
	return Buffer.from(robotMapType.encode(message).finish());
}

describe('B01MapParser', () => {
	let parser: B01MapParser;

	beforeEach(() => {
		parser = new B01MapParser();
	});

	describe('parseRooms', () => {
		it('returns empty rooms and mapId when roomDataInfo is absent', () => {
			const buffer = encodeRobotMap({ mapType: 1, mapHead: { mapHeadId: 42 } });
			const result = parser.parseRooms(buffer);
			expect(result.rooms).toEqual([]);
			expect(result.mapId).toBe(42);
		});

		it('returns empty rooms when roomDataInfo is empty array', () => {
			const buffer = encodeRobotMap({ mapType: 1, roomDataInfo: [] });
			const result = parser.parseRooms(buffer);
			expect(result.rooms).toEqual([]);
		});

		it('maps roomDataInfo fields to B01RoomInfo correctly', () => {
			const buffer = encodeRobotMap({
				mapType: 1,
				roomDataInfo: [{ roomId: 10, roomName: 'Living Room', roomTypeId: 3, colorId: 7 }],
			});
			const result = parser.parseRooms(buffer);
			expect(result.rooms).toHaveLength(1);
			expect(result.rooms[0]).toMatchObject({ roomId: 10, roomName: 'Living Room', roomTypeId: 3, colorId: 7 });
		});

		it('includes labelPos when roomNamePost is present', () => {
			const buffer = encodeRobotMap({
				mapType: 1,
				roomDataInfo: [{ roomId: 1, roomName: 'Room', roomNamePost: { x: 5.0, y: 10.0 } }],
			});
			const result = parser.parseRooms(buffer);
			expect(result.rooms[0].labelPos).toEqual({ x: 5, y: 10 });
		});

		it('omits labelPos when roomNamePost is absent', () => {
			const buffer = encodeRobotMap({
				mapType: 1,
				roomDataInfo: [{ roomId: 2, roomName: 'Room2' }],
			});
			const result = parser.parseRooms(buffer);
			expect(result.rooms[0].labelPos).toBeUndefined();
		});

		it('extracts mapId from mapHead.mapHeadId when > 0', () => {
			const buffer = encodeRobotMap({
				mapType: 1,
				mapHead: { mapHeadId: 100 },
				roomDataInfo: [{ roomId: 1, roomName: 'R' }],
			});
			const result = parser.parseRooms(buffer);
			expect(result.mapId).toBe(100);
		});

		it('returns undefined mapId when mapHeadId === 0', () => {
			const buffer = encodeRobotMap({
				mapType: 1,
				mapHead: { mapHeadId: 0 },
				roomDataInfo: [{ roomId: 1, roomName: 'R' }],
			});
			const result = parser.parseRooms(buffer);
			expect(result.mapId).toBeUndefined();
		});
	});

	describe('decodeBase64IfNeeded', () => {
		it('decodes Base64-encoded data when sample matches Base64 pattern', () => {
			const raw = Buffer.from('hello world');
			const base64 = Buffer.from(raw.toString('base64'), 'utf8');
			const result = (parser as unknown as { decodeBase64IfNeeded: (d: Buffer) => Buffer }).decodeBase64IfNeeded(
				base64,
			);
			expect(result.toString('utf8')).toBe('hello world');
		});

		it('returns raw buffer when data is not Base64-encoded (binary data)', () => {
			// Binary data with bytes > 127 won't match the Base64 char pattern
			const raw = Buffer.from([0x00, 0xff, 0x80, 0x7f, 0x12]);
			const result = (parser as unknown as { decodeBase64IfNeeded: (d: Buffer) => Buffer }).decodeBase64IfNeeded(raw);
			expect(result).toEqual(raw);
		});
	});

	describe('asciiHexToBinaryIfNeeded', () => {
		it('converts ASCII hex data starting with "78" to binary', () => {
			// zlib deflate magic bytes start with 0x78
			const rawBinary = Buffer.from([0x78, 0x9c, 0x01, 0x00]);
			const hexString = rawBinary.toString('hex'); // "789c0100"
			const hexBuffer = Buffer.from(hexString, 'utf8');
			const result = (
				parser as unknown as { asciiHexToBinaryIfNeeded: (d: Buffer) => Buffer }
			).asciiHexToBinaryIfNeeded(hexBuffer);
			expect(result[0]).toBe(0x78);
			expect(result[1]).toBe(0x9c);
		});

		it('returns data unchanged when not hex-encoded', () => {
			// Starts with non-hex prefix so detection fails
			const raw = Buffer.from('not hex data here!!');
			const result = (
				parser as unknown as { asciiHexToBinaryIfNeeded: (d: Buffer) => Buffer }
			).asciiHexToBinaryIfNeeded(raw);
			expect(result).toEqual(raw);
		});
	});

	describe('decryptIfNeeded', () => {
		it('skips decryption when data.length % 16 !== 0', () => {
			const data = Buffer.from([1, 2, 3]); // length 3, not multiple of 16
			const result = (
				parser as unknown as { decryptIfNeeded: (d: Buffer, m: string, s: string) => Buffer }
			).decryptIfNeeded(data, 'MODEL', 'SERIAL');
			expect(result).toEqual(data);
		});

		it('applies AES-128-ECB decryption when data.length % 16 === 0', () => {
			// Encrypt a known block with PKCS7 padding so decryptIfNeeded (setAutoPadding=true) can decrypt it
			const modelShortCode = 'S7';
			const serial = 'ABC12345';
			const key = (parser as unknown as { deriveEncryptionKey: (m: string, s: string) => Buffer }).deriveEncryptionKey(
				modelShortCode,
				serial,
			);

			const plaintext = Buffer.from('test plaintext!!'); // exactly 16 bytes
			// Use setAutoPadding(true) on encrypt so decrypt with setAutoPadding(true) works
			const cipher = crypto.createCipheriv('aes-128-ecb', key, null);
			cipher.setAutoPadding(true);
			const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
			// encrypted will be 32 bytes (16 data + 16 PKCS7 padding block)
			expect(encrypted.length % 16).toBe(0);

			const result = (
				parser as unknown as { decryptIfNeeded: (d: Buffer, m: string, s: string) => Buffer }
			).decryptIfNeeded(encrypted, modelShortCode, serial);
			expect(result.toString('utf8')).toBe('test plaintext!!');
		});
	});

	describe('deriveEncryptionKey', () => {
		it('produces consistent key for same modelShortCode + serial', () => {
			const key1 = (parser as unknown as { deriveEncryptionKey: (m: string, s: string) => Buffer }).deriveEncryptionKey(
				'S7',
				'SN001',
			);
			const key2 = (parser as unknown as { deriveEncryptionKey: (m: string, s: string) => Buffer }).deriveEncryptionKey(
				'S7',
				'SN001',
			);
			expect(key1).toEqual(key2);
		});

		it('produces different keys for different serial numbers', () => {
			const key1 = (parser as unknown as { deriveEncryptionKey: (m: string, s: string) => Buffer }).deriveEncryptionKey(
				'S7',
				'SN001',
			);
			const key2 = (parser as unknown as { deriveEncryptionKey: (m: string, s: string) => Buffer }).deriveEncryptionKey(
				'S7',
				'SN002',
			);
			expect(key1).not.toEqual(key2);
		});
	});

	describe('parseRoomsFromEncryptedBinary — round-trip (no encryption)', () => {
		it('parses valid compressed binary with no encryption/encoding', () => {
			// Build a protobuf buffer, deflate it, then parse it back
			const protoBuffer = encodeRobotMap({
				mapType: 1,
				mapHead: { mapHeadId: 7 },
				roomDataInfo: [{ roomId: 99, roomName: 'TestRoom' }],
			});
			const compressed = zlib.deflateSync(protoBuffer);
			// Pass as raw binary (non-base64, non-hex) and non-16-aligned length
			// Ensure length is NOT multiple of 16 to skip decryption
			const nonMultiple = compressed.length % 16 === 0 ? Buffer.concat([compressed, Buffer.from([0x01])]) : compressed;

			const result = parser.parseRoomsFromEncryptedBinary(nonMultiple, 'MODEL', 'SERIAL');
			expect(result.rooms.some((r) => r.roomId === 99 && r.roomName === 'TestRoom')).toBe(true);
		});
	});
});
