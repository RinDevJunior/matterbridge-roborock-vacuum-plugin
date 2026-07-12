import { beforeEach, describe, expect, it } from 'vitest';

import { decompressLZ4Block } from '../../../../../roborockCommunication/map/b01/q10/lz4BlockDecompressor.js';

describe('lz4BlockDecompressor', () => {
	describe('decompressLZ4Block', () => {
		it('should round-trip all-literal block without matches', () => {
			// All-literal block: token byte with high nibble = data length
			// Format: [token, ...literalBytes]
			// token = (literalLength << 4) | matchLength
			// For all-literal, matchLength is irrelevant since cursor reaches end after literal copy
			const originalData = Buffer.from('Hello, World!');
			const token = originalData.length << 4; // literalLength = 13, matchLength = 0
			const compressed = Buffer.concat([Buffer.from([token]), originalData]);

			const decompressed = decompressLZ4Block(compressed);
			expect(decompressed).toEqual(originalData);
		});

		it('should decompress block with one back-reference match (short literal, RLE-like copy)', () => {
			// Build: [token, literal="ABC", offset_lo, offset_hi, (implied matchLength via token)]
			// Token: literalLength=3 (ABC), matchLength=4 (0 nibble + 4 min = 4 bytes)
			const token = (3 << 4) | 0; // literalLength=3, matchLength_nibble=0 (→ 4 bytes)
			const literal = Buffer.from('ABC');
			const offsetLo = 1; // back 1 byte from current end (offset is LE: 0x0001 = 1)
			const offsetHi = 0;
			const offset = Buffer.from([offsetLo, offsetHi]); // little-endian: 0x0001
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset]);

			const decompressed = decompressLZ4Block(compressed);
			// Expected: "ABC" (literal) + "CCCC" (4-byte RLE copy from offset=1, which is byte 'C')
			expect(decompressed).toEqual(Buffer.from('ABCCCCC'));
		});

		it('should handle overlapping/self-referential copy (offset smaller than matchLength)', () => {
			// Offset=1, matchLength=4 should repeat the last byte 4 times (LZ4 RLE pattern)
			// Build a simple case: literal "X", then copy offset=1, length=4
			const token = (1 << 4) | 0; // 1 literal byte, matchLength_nibble=0 (→ 4)
			const literal = Buffer.from('X');
			const offsetLo = 1;
			const offsetHi = 0;
			const offset = Buffer.from([offsetLo, offsetHi]);
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset]);

			const decompressed = decompressLZ4Block(compressed);
			// Expect: "X" + "XXXX"
			expect(decompressed).toEqual(Buffer.from('XXXXX'));
		});

		it('should handle length-extension encoding for literalLength', () => {
			// literalLength nibble = 0x0F (15), then length-extension bytes
			// Format: token with high nibble = 0x0F, then continuation bytes (0xFF... + final non-0xFF)
			// Example: literalLength = 15 + 255 + 255 + 5 = 530
			const literalData = Buffer.alloc(530, 65); // 530 bytes of 'A'
			const token = (0x0f << 4) | 0; // high nibble = 0x0F, low = 0 (no match follows)
			// Length extension: 0xFF, 0xFF, 0x05 means extra = 255 + 255 + 5 = 515, total = 15 + 515 = 530
			const lengthExt = Buffer.from([0xff, 0xff, 0x05]);
			const compressed = Buffer.concat([Buffer.from([token]), lengthExt, literalData]);

			const decompressed = decompressLZ4Block(compressed);
			expect(decompressed).toEqual(literalData);
		});

		it('should handle length-extension encoding for matchLength', () => {
			// matchLength nibble = 0x0F, length extension follows offset
			// Simple case: literal "Y" (1 byte), offset=1, then matchLength_nibble=0x0F + extension
			// matchLength = (0x0F + 4) + 255 = 19 + 255 = 274
			const token = (1 << 4) | 0x0f; // literalLength=1, matchLength_nibble=0x0F
			const literal = Buffer.from('Y');
			const offsetLo = 1;
			const offsetHi = 0;
			const offset = Buffer.from([offsetLo, offsetHi]);
			// After offset, length extension: 0xFF, 0x00 (255 + 0 = 255 extra, total = 15 + 4 + 255 = 274)
			const lengthExt = Buffer.from([0xff, 0x00]); // extra = 255
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset, lengthExt]);

			const decompressed = decompressLZ4Block(compressed);
			// Expect: "Y" + 274 bytes of "Y" (RLE from offset=1) = 275 bytes total
			const expected = Buffer.alloc(275, 89); // 275 'Y's
			expect(decompressed).toEqual(expected);
		});

		it('should throw "LZ4 block: truncated literal" when literal run extends past buffer', () => {
			const token = (10 << 4) | 0; // expect 10 literal bytes
			const literal = Buffer.from('ABC'); // only 3 bytes provided
			const compressed = Buffer.concat([Buffer.from([token]), literal]);

			expect(() => decompressLZ4Block(compressed)).toThrow('LZ4 block: truncated literal');
		});

		it('should throw "LZ4 block: truncated offset" when offset bytes are missing', () => {
			const token = (1 << 4) | 1; // 1 literal byte, matchLength_nibble=1 (→ 5 bytes copy)
			const literal = Buffer.from('A');
			const offset1 = Buffer.from([0x01]); // Only 1 byte of offset instead of 2
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset1]);

			expect(() => decompressLZ4Block(compressed)).toThrow('LZ4 block: truncated offset');
		});

		it('should throw "LZ4 block: invalid offset 0" when offset is zero', () => {
			const token = (1 << 4) | 1; // 1 literal byte, matchLength_nibble=1 (→ 5 bytes)
			const literal = Buffer.from('A');
			const offsetLo = 0;
			const offsetHi = 0;
			const offset = Buffer.from([offsetLo, offsetHi]);
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset]);

			expect(() => decompressLZ4Block(compressed)).toThrow('LZ4 block: invalid offset 0');
		});

		it('should throw "LZ4 block: invalid offset" when offset exceeds decoded bytes so far', () => {
			const token = (2 << 4) | 1; // 2 literal bytes, matchLength=5
			const literal = Buffer.from('AB');
			const offsetLo = 0x05; // offset = 5 (little-endian)
			const offsetHi = 0x00;
			const offset = Buffer.from([offsetLo, offsetHi]);
			const compressed = Buffer.concat([Buffer.from([token]), literal, offset]);

			// At this point we've only output 2 bytes (AB), but offset wants to go back 5 bytes
			expect(() => decompressLZ4Block(compressed)).toThrow(/LZ4 block: invalid offset 5/);
		});

		it('should throw "LZ4 block: truncated length" when length-extension byte is cut off', () => {
			const token = (0x0f << 4) | 0; // literalLength nibble = 0x0F
			const lengthExtPartial = Buffer.from([0xff]); // incomplete: needs at least one non-0xFF byte
			const compressed = Buffer.concat([Buffer.from([token]), lengthExtPartial]);

			expect(() => decompressLZ4Block(compressed)).toThrow('LZ4 block: truncated length');
		});

		it('should not throw when cursor reaches data.length exactly after token+literal with no match', () => {
			// Valid end-of-block: token, literal data, and cursor lands exactly at data.length
			const token = (5 << 4) | 0; // 5 literal bytes, no match
			const literal = Buffer.from('ABCDE');
			const compressed = Buffer.concat([Buffer.from([token]), literal]);

			// Should not throw — cursor.pos will equal data.length right after literal copy
			const decompressed = decompressLZ4Block(compressed);
			expect(decompressed).toEqual(literal);
		});

		it('should decompress a realistic payload with multiple blocks (literal + match + literal pattern)', () => {
			// Build a block with: literal "AB" (2 bytes) + match (offset=1, length=4) + literal "CD" (2 bytes)
			// Token 1: 2 literal bytes "AB", matchLength_nibble=0 (→ 4 bytes copy)
			const token1 = (2 << 4) | 0; // 2 literals, matchLength=4
			const lit1 = Buffer.from('AB');
			const offset1Lo = 1; // offset = 1 (go back 1 from end of "AB", which is "B")
			const offset1Hi = 0;
			const offset1 = Buffer.from([offset1Lo, offset1Hi]);
			// After this: "AB" + "BBBB" (4-byte RLE copy of B from offset=1)

			// Token 2: 2 literal bytes "CD", no match
			const token2 = (2 << 4) | 0;
			const lit2 = Buffer.from('CD');

			const compressed = Buffer.concat([Buffer.from([token1]), lit1, offset1, Buffer.from([token2]), lit2]);

			const decompressed = decompressLZ4Block(compressed);
			// Expected: "AB" + "BBBB" (from offset=1, len=4) + "CD"
			expect(decompressed).toEqual(Buffer.from('ABBBBBCD'));
		});
	});
});
