import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENGINES } from '../../settings.js';
import { checkDependencyVersions } from '../../share/dependency-check.js';
import { asPartial, createMockLogger, createMockMatterbridge } from '../helpers/testUtils.js';

describe('checkDependencyVersions (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it('should log a warning when the Matterbridge version cannot be coerced to semver', () => {
		// Arrange
		const platform = asPartial<MatterbridgeDynamicPlatform>({
			log: mockLogger,
			matterbridge: createMockMatterbridge({ matterbridgeVersion: 'not-a-version' }),
		});
		// Act
		checkDependencyVersions(platform);
		// Assert
		expect(mockLogger.warn).toHaveBeenCalledWith(
			`Matterbridge version not-a-version cannot be coerced to semver (require ${ENGINES['matterbridge']})`,
		);
		expect(mockLogger.error).not.toHaveBeenCalled();
	});
});
