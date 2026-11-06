import { describe, expect, it } from 'vitest';

import { decodeFeatureSet } from '../../share/featureSetDecoder.js';

describe('decodeFeatureSet (gap coverage)', () => {
	it('should report the nibble bit as set when the hex character at that position is valid', () => {
		// Arrange
		const newFeatureSet = 'f00000000';

		// Act
		const features = decodeFeatureSet(undefined, newFeatureSet);

		// Assert
		expect(features.is_two_key_real_time_video_supported).toBe(true);
	});

	it('should report the nibble bit as false when the hex character at that position is not a hex digit', () => {
		// Arrange
		const newFeatureSet = 'z00000000';

		// Act
		const features = decodeFeatureSet(undefined, newFeatureSet);

		// Assert
		expect(features.is_two_key_real_time_video_supported).toBe(false);
	});
});
