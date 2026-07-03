import crypto from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { decryptAndUnzipV1Map } from '../../../../roborockCommunication/map/v1/v1MapDecryptor.js';
import { buildEncryptedV1MapPayload, buildLegacyMapBuffer } from '../../../testUtils.js';

describe('decryptAndUnzipV1Map', () => {
	it('round-trips: encrypted payload decrypts back to the original "rr" binary', () => {
		const rrBinary = buildLegacyMapBuffer({ robotPosition: { x: 1000, y: 2000, angle: 90 } });
		const sessionNonce = crypto.randomBytes(16);
		const payload = buildEncryptedV1MapPayload(rrBinary, sessionNonce);

		const result = decryptAndUnzipV1Map(payload, sessionNonce);

		expect(result).toEqual(rrBinary);
	});

	it('throws when decrypted with the wrong nonce', () => {
		const rrBinary = buildLegacyMapBuffer({ robotPosition: { x: 1000, y: 2000, angle: 90 } });
		const sessionNonce = crypto.randomBytes(16);
		const wrongNonce = crypto.randomBytes(16);
		const payload = buildEncryptedV1MapPayload(rrBinary, sessionNonce);

		expect(() => decryptAndUnzipV1Map(payload, wrongNonce)).toThrow();
	});

	it('throws "too small" for a buffer at or below the 24-byte envelope size', () => {
		const sessionNonce = crypto.randomBytes(16);
		expect(() => decryptAndUnzipV1Map(Buffer.alloc(24), sessionNonce)).toThrow(/too small/);
		expect(() => decryptAndUnzipV1Map(Buffer.alloc(10), sessionNonce)).toThrow(/too small/);
	});

	it('decrypts correctly with a deterministic all-zero nonce', () => {
		const rrBinary = buildLegacyMapBuffer({ chargerPosition: { x: 500, y: 750, angle: 180 } });
		const sessionNonce = Buffer.alloc(16, 0);
		const payload = buildEncryptedV1MapPayload(rrBinary, sessionNonce);

		const result = decryptAndUnzipV1Map(payload, sessionNonce);

		expect(result).toEqual(rrBinary);
	});
});
