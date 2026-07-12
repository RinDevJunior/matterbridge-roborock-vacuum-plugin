const LITERAL_LENGTH_MASK = 0xf0;
const MATCH_LENGTH_MASK = 0x0f;
const LENGTH_EXTENSION_MARKER = 0x0f;
const MIN_MATCH_LENGTH = 4;

interface Cursor {
	pos: number;
}

/**
 * Decompresses a standard LZ4 *block* (no frame header): token byte
 * (literal-length nibble, match-length nibble), `0x0F`-continuation length
 * extension, literal copy, then 2-byte LE back-reference offset + copy loop.
 */
export function decompressLZ4Block(data: Buffer): Buffer {
	const output: number[] = [];
	const cursor: Cursor = { pos: 0 };

	while (cursor.pos < data.length) {
		const token = data[cursor.pos];
		cursor.pos += 1;

		let literalLength = (token & LITERAL_LENGTH_MASK) >> 4;
		if (literalLength === LENGTH_EXTENSION_MARKER) {
			literalLength += readLengthExtension(data, cursor);
		}

		if (cursor.pos + literalLength > data.length) {
			throw new Error('LZ4 block: truncated literal');
		}
		for (let i = 0; i < literalLength; i++) {
			output.push(data[cursor.pos + i]);
		}
		cursor.pos += literalLength;

		if (cursor.pos >= data.length) {
			break;
		}

		if (cursor.pos + 2 > data.length) {
			throw new Error('LZ4 block: truncated offset');
		}
		const offset = data.readUInt16LE(cursor.pos);
		cursor.pos += 2;

		if (offset === 0 || offset > output.length) {
			throw new Error(`LZ4 block: invalid offset ${offset}`);
		}

		let matchLength = (token & MATCH_LENGTH_MASK) + MIN_MATCH_LENGTH;
		if ((token & MATCH_LENGTH_MASK) === LENGTH_EXTENSION_MARKER) {
			matchLength += readLengthExtension(data, cursor);
		}

		const matchStart = output.length - offset;
		for (let i = 0; i < matchLength; i++) {
			output.push(output[matchStart + i]);
		}
	}

	return Buffer.from(output);
}

function readLengthExtension(data: Buffer, cursor: Cursor): number {
	let extra = 0;
	let byte: number;
	do {
		if (cursor.pos >= data.length) {
			throw new Error('LZ4 block: truncated length');
		}
		byte = data[cursor.pos];
		cursor.pos += 1;
		extra += byte;
	} while (byte === 0xff);
	return extra;
}
