import { IslandClassification } from './legacyIslandDetection.js';

/**
 * Minimal embedded 3x5-pixel bitmap font for digits 0-9. Each entry is 5 rows x 3 cols of 0/1,
 * intentionally simple (no anti-aliasing, no external font library) — just enough to stamp a
 * readable displayIndex number onto a small diagnostic map image.
 */
const DIGIT_GLYPHS: Record<string, number[][]> = {
	'0': [
		[1, 1, 1],
		[1, 0, 1],
		[1, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
	],
	'1': [
		[0, 1, 0],
		[1, 1, 0],
		[0, 1, 0],
		[0, 1, 0],
		[1, 1, 1],
	],
	'2': [
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
	],
	'3': [
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
	],
	'4': [
		[1, 0, 1],
		[1, 0, 1],
		[1, 1, 1],
		[0, 0, 1],
		[0, 0, 1],
	],
	'5': [
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
	],
	'6': [
		[1, 1, 1],
		[1, 0, 0],
		[1, 1, 1],
		[1, 0, 1],
		[1, 1, 1],
	],
	'7': [
		[1, 1, 1],
		[0, 0, 1],
		[0, 0, 1],
		[0, 0, 1],
		[0, 0, 1],
	],
	'8': [
		[1, 1, 1],
		[1, 0, 1],
		[1, 1, 1],
		[1, 0, 1],
		[1, 1, 1],
	],
	'9': [
		[1, 1, 1],
		[1, 0, 1],
		[1, 1, 1],
		[0, 0, 1],
		[1, 1, 1],
	],
};

const GLYPH_COLS = 3;
const GLYPH_ROWS = 5;
const SCALE = 2;
const GLYPH_WIDTH_PX = GLYPH_COLS * SCALE; // 6
const GLYPH_HEIGHT_PX = GLYPH_ROWS * SCALE; // 10
const DIGIT_SPACING_PX = 1;

function setPixel(
	rgbBuffer: Buffer,
	width: number,
	height: number,
	x: number,
	y: number,
	rgb: [number, number, number],
): void {
	if (x < 0 || y < 0 || x >= width || y >= height) return;
	const offset = (y * width + x) * 3;
	rgbBuffer[offset] = rgb[0];
	rgbBuffer[offset + 1] = rgb[1];
	rgbBuffer[offset + 2] = rgb[2];
}

function drawDigit(
	rgbBuffer: Buffer,
	width: number,
	height: number,
	originX: number,
	originY: number,
	digit: string,
): void {
	const glyph = DIGIT_GLYPHS[digit];
	if (!glyph) return;
	for (let row = 0; row < GLYPH_ROWS; row++) {
		for (let col = 0; col < GLYPH_COLS; col++) {
			if (glyph[row][col] !== 1) continue;
			for (let sy = 0; sy < SCALE; sy++) {
				for (let sx = 0; sx < SCALE; sx++) {
					setPixel(rgbBuffer, width, height, originX + col * SCALE + sx, originY + row * SCALE + sy, [0, 0, 0]);
				}
			}
		}
	}
}

/**
 * Stamps each island's displayIndex as small pixel-drawn digits directly onto the image, anchored
 * at that island's bounding-box top-left corner. Draws a white background rectangle first so the
 * digits stay legible over any underlying color. Labels are clamped to the buffer's bounds (never
 * throws on overflow); overlapping labels between islands are accepted in this first pass.
 */
export function stampIslandLabels(
	rgbBuffer: Buffer,
	width: number,
	height: number,
	classifications: IslandClassification[],
): void {
	for (const classification of classifications) {
		const label = String(classification.displayIndex);
		const numDigits = label.length;
		const labelWidth = numDigits * (GLYPH_WIDTH_PX + DIGIT_SPACING_PX);
		const labelHeight = GLYPH_HEIGHT_PX;

		const anchorX = classification.island.bounds.minX;
		const anchorY = classification.island.bounds.minY;

		if (anchorX >= width || anchorY >= height || anchorX + labelWidth <= 0 || anchorY + labelHeight <= 0) {
			// Entirely outside the buffer — nothing to draw.
			continue;
		}

		for (let y = anchorY; y < anchorY + labelHeight; y++) {
			for (let x = anchorX; x < anchorX + labelWidth; x++) {
				setPixel(rgbBuffer, width, height, x, y, [255, 255, 255]);
			}
		}

		for (let i = 0; i < numDigits; i++) {
			const digitOriginX = anchorX + i * (GLYPH_WIDTH_PX + DIGIT_SPACING_PX);
			drawDigit(rgbBuffer, width, height, digitOriginX, anchorY, label[i]);
		}
	}
}
