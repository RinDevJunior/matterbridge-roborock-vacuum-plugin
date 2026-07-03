import crypto from 'node:crypto';
import zlib from 'node:zlib';

const V1_MAP_ENVELOPE_SIZE = 24;

/**
 * Strips the 24-byte envelope, AES-128-CBC decrypts (key=sessionNonce, IV=zeros),
 * then gzip decompresses the V1 map binary.
 * Returns the raw "rr"-prefixed map frame ready for LegacyMapParser.parse().
 */
export function decryptAndUnzipV1Map(buffer: Buffer, sessionNonce: Buffer): Buffer {
	if (buffer.length <= V1_MAP_ENVELOPE_SIZE) {
		throw new Error(`V1 map buffer too small: ${buffer.length} bytes`);
	}
	const iv = Buffer.alloc(16, 0);
	const decipher = crypto.createDecipheriv('aes-128-cbc', sessionNonce, iv);
	const decrypted = Buffer.concat([decipher.update(buffer.subarray(V1_MAP_ENVELOPE_SIZE)), decipher.final()]);
	return zlib.gunzipSync(decrypted);
}
