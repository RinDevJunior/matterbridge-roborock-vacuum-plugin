import type { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FilterLogger } from '../../share/filterLogger.js';
import { createMockLogger } from '../helpers/testUtils.js';

describe('FilterLogger (gaps)', () => {
	let delegate: AnsiLogger;
	let filterLogger: FilterLogger;

	beforeEach(() => {
		vi.clearAllMocks();
		delegate = createMockLogger();
		delegate.logName = 'delegate-name';
		filterLogger = new FilterLogger(delegate);
	});

	it('should return the delegate logName when logName is read', () => {
		// Arrange
		delegate.logName = 'a';
		// Act
		const name = filterLogger.logName;
		// Assert
		expect(name).toBe('a');
	});

	it('should write the logName through to the delegate when logName is set', () => {
		// Arrange
		// Act
		filterLogger.logName = 'b';
		// Assert
		expect(delegate.logName).toBe('b');
	});
});
