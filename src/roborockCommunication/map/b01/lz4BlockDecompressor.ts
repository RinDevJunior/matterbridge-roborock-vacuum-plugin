export function decompressLz4Block(data: Buffer): Buffer {
	let index = 0;
	const output: number[] = [];

	while (index < data.length) {
		const token = data[index];
		index += 1;

		let literalLength = token >> 4;
		if (literalLength === 15) {
			while (data[index] === 255) {
				literalLength += 255;
				index += 1;
				if (index >= data.length) {
					throw new Error('LZ4 block decompress failed: unexpected end of input');
				}
			}
			literalLength += data[index];
			index += 1;
		}

		if (index + literalLength > data.length) {
			throw new Error('LZ4 block decompress failed: unexpected end of input');
		}
		for (let i = 0; i < literalLength; i++) {
			output.push(data[index + i]);
		}
		index += literalLength;

		if (index >= data.length) {
			break;
		}

		if (index + 2 > data.length) {
			throw new Error('LZ4 block decompress failed: unexpected end of input');
		}
		const matchOffset = data[index] | (data[index + 1] << 8);
		index += 2;

		let matchLength = token & 0x0f;
		if (matchLength === 15) {
			while (data[index] === 255) {
				matchLength += 255;
				index += 1;
				if (index >= data.length) {
					throw new Error('LZ4 block decompress failed: unexpected end of input');
				}
			}
			matchLength += data[index];
			index += 1;
		}
		matchLength += 4;

		if (matchOffset === 0 || matchOffset > output.length) {
			throw new Error('LZ4 block decompress failed: invalid match offset');
		}
		for (let i = 0; i < matchLength; i++) {
			output.push(output[output.length - matchOffset]);
		}
	}

	return Buffer.from(output);
}
