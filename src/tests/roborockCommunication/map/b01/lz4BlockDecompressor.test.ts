import { describe, expect, it } from 'vitest';

import { decompressLz4Block } from '../../../../roborockCommunication/map/b01/lz4BlockDecompressor.js';

describe('lz4BlockDecompressor', () => {
	describe('decompressLz4Block', () => {
		it('should return empty buffer for empty input', () => {
			const result = decompressLz4Block(Buffer.alloc(0));
			expect(Buffer.isBuffer(result)).toBe(true);
			expect(result.length).toBe(0);
		});

		it('should handle all-literal block with no match section', () => {
			// Token byte: 0x30 = literalLength nibble 3 (low), matchLength nibble 0 (high)
			// Literals: "ABC"
			// No match section, so block ends
			const data = Buffer.from([0x30, 0x41, 0x42, 0x43]); // 0x41='A', 0x42='B', 0x43='C'
			const result = decompressLz4Block(data);
			expect(result.toString('utf8')).toBe('ABC');
		});

		it('should handle literal block followed by a simple back-reference', () => {
			// Token byte: 0x15 = literalLength nibble 1 (high), matchLength nibble 5 (low)
			// Literals: "A" (1 byte)
			// Match offset: 0x01 0x00 (little-endian u16 = 1, pointing 1 byte back = RLE from "A")
			// Match length: 5 + 4 = 9 (minimum match length is 4)
			// Output: "A" + 9 bytes copied from 1 byte back = "A" + "AAAAAAAAA" = 10 "A"s
			const data = Buffer.from([
				0x15, // token: literalLen=1, matchLen=5
				0x41, // literal: "A"
				0x01,
				0x00, // matchOffset=1 (little-endian)
			]);
			const result = decompressLz4Block(data);
			expect(result.length).toBe(10); // 1 literal + 9 match bytes
			expect(result.toString('utf8')).toBe('A'.repeat(10));
		});

		it('should handle extension bytes for literal length when literalLength nibble is 15', () => {
			// Token byte: 0xF0 = literalLength nibble 15 (high), matchLength nibble 0 (low)
			// Extension bytes for literal length: one 0xFF (adds 255), then 0x05 (adds 5) = 15 + 255 + 5 = 275
			// Literals: 275 bytes of 'X'
			// No match section
			const literalCount = 275;
			const data = Buffer.concat([
				Buffer.from([0xf0, 0xff, 0x05]), // token + extension bytes
				Buffer.alloc(literalCount, 0x58), // 275 'X' bytes
			]);
			const result = decompressLz4Block(data);
			expect(result.length).toBe(literalCount);
			expect(result.toString('utf8')).toBe('X'.repeat(literalCount));
		});

		it('should handle extension bytes for match length when match length nibble is 15', () => {
			// Token byte: 0x1F = literalLength nibble 1 (high), matchLength nibble 15 (low)
			// Literals: "A" (1 byte)
			// Match offset: 0x01 0x00 (little-endian u16 = 1, copy from 1 byte back = RLE)
			// Match length extension: 0xFF (adds 255), then 0x04 (adds 4) = 15 + 255 + 4 = 274
			// Match length: 274 + 4 = 278
			// Should copy 278 'A's from 1 byte back, creating "A" repeated 279 times total
			const data = Buffer.concat([
				Buffer.from([
					0x1f, // token: literalLen=1, matchLen=15
					0x41, // literal: "A"
					0x01,
					0x00, // matchOffset = 1 (little-endian)
					0xff,
					0x04, // extension bytes for match length
				]),
			]);
			const result = decompressLz4Block(data);
			expect(result.length).toBe(1 + 278); // 1 literal + 278 match bytes
			expect(result.toString('utf8')).toBe('A'.repeat(279));
		});

		it('should handle overlapping match copy (RLE-style repeat): offset=1, length=9', () => {
			// This is the golden regression test from python-roborock's test fixture
			// Token byte: 0x14 = literalLength nibble 1 (high), matchLength nibble 4 (low)
			// Literals: "A" (1 byte)
			// Match offset: 0x01 0x00 (little-endian u16 = 1)
			// Match length: 4 + 4 = 8
			// Expected output: "A" + "AAAAAAAA" = 9 'A's total
			// But the match copy is 8 bytes from offset 1, which creates: "AAAAAAAA"
			// Total: "A" (literal) + "AAAAAAAA" (match) = 9 bytes
			const data = Buffer.from([0x14, 0x41, 0x01, 0x00]);
			const result = decompressLz4Block(data);
			expect(result.toString('utf8')).toBe('A'.repeat(9));
		});

		it('should throw error when match offset is zero', () => {
			// Token byte: 0x05 = literalLength 0, matchLength 5
			// Literals: none
			// Match offset: 0x00 0x00 (zero, invalid)
			const data = Buffer.from([0x05, 0x00, 0x00]);
			expect(() => decompressLz4Block(data)).toThrow(/LZ4 block decompress failed:/);
		});

		it('should throw error when match offset exceeds current output length', () => {
			// Token byte: 0x10 = literalLength 1, matchLength 0
			// Literals: "X" (1 byte)
			// Match offset: 0x0A 0x00 (10, but output is only 1 byte long)
			const data = Buffer.from([0x10, 0x58, 0x0a, 0x00]);
			expect(() => decompressLz4Block(data)).toThrow(/LZ4 block decompress failed:/);
		});

		it('should throw error when match offset is greater than output.length', () => {
			// Token byte: 0x15 = literalLength 1, matchLength 5
			// Literals: "A" (1 byte)
			// Match offset: 0x05 0x00 (5, but output is only 1 byte)
			const data = Buffer.from([0x15, 0x41, 0x05, 0x00]);
			expect(() => decompressLz4Block(data)).toThrow(/LZ4 block decompress failed:/);
		});
	});
});
