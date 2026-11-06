import { AnsiLogger } from 'matterbridge/logger';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AreaManagementService } from '../../services/areaManagementService.js';
import { createMockLogger } from '../helpers/testUtils.js';

describe('AreaManagementService restored-run pending flag', () => {
	let logger: AnsiLogger;
	let service: AreaManagementService;

	beforeEach(() => {
		vi.clearAllMocks();
		logger = createMockLogger();
		service = new AreaManagementService(logger, undefined);
	});

	it('should return true from consumeRestoredRunPending after markRestoredRunPending', () => {
		service.markRestoredRunPending('duid-a');

		expect(service.consumeRestoredRunPending('duid-a')).toBe(true);
	});

	it('should return false on a second consume so the flag is only usable once', () => {
		service.markRestoredRunPending('duid-a');
		service.consumeRestoredRunPending('duid-a');

		expect(service.consumeRestoredRunPending('duid-a')).toBe(false);
	});

	it('should return false for an unknown duid', () => {
		expect(service.consumeRestoredRunPending('never-marked')).toBe(false);
	});

	it('should isolate the pending flag per duid', () => {
		service.markRestoredRunPending('duid-a');

		expect(service.consumeRestoredRunPending('duid-b')).toBe(false);
		expect(service.consumeRestoredRunPending('duid-a')).toBe(true);
	});

	it('should clear pending flags when the service is cleared', () => {
		service.markRestoredRunPending('duid-a');

		service.clearAll();

		expect(service.consumeRestoredRunPending('duid-a')).toBe(false);
	});

	it('should not be affected by a mirror flag set for the same duid', () => {
		service.setLastActivelyCleaningState('duid-a', true);
		service.markRestoredRunPending('duid-a');

		expect(service.getLastActivelyCleaningState('duid-a')).toBe(true);
		expect(service.consumeRestoredRunPending('duid-a')).toBe(true);
	});
});
