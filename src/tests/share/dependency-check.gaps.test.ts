import type { MatterbridgeDynamicPlatform } from 'matterbridge';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ENGINES } from '../../settings.js';
import { checkDependencyVersions } from '../../share/dependency-check.js';
import { asPartial, createMockLogger, createMockMatterbridge } from '../helpers/testUtils.js';

// Pinned Node version inside the engines range (">=24 <25") so the Nodejs row
// never depends on the Node binary running the suite (Node 25 logs an error).
const PINNED_NODE_VERSION = '24.13.1';

describe('checkDependencyVersions (gaps)', () => {
	let mockLogger: ReturnType<typeof createMockLogger>;
	let originalVersionsDescriptor: PropertyDescriptor | undefined;

	beforeEach(() => {
		vi.clearAllMocks();
		mockLogger = createMockLogger();
		originalVersionsDescriptor = Object.getOwnPropertyDescriptor(process, 'versions');
		Object.defineProperty(process, 'versions', {
			value: { ...process.versions, node: PINNED_NODE_VERSION },
			configurable: true,
		});
	});

	afterEach(() => {
		if (originalVersionsDescriptor) {
			Object.defineProperty(process, 'versions', originalVersionsDescriptor);
		}
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
