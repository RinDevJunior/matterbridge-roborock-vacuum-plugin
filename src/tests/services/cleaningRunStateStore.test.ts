import type { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import type { LocalStorage } from 'node-persist';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CleaningRunStateStore } from '../../services/cleaningRunStateStore.js';
import { CLEANING_RUN_SNAPSHOT_VERSION, type CleaningRunSnapshot } from '../../share/cleaningRunSnapshot.js';
import { createMockLocalStorage, createMockLogger } from '../helpers/testUtils.js';

const NOW = 1_800_000_000_000;
const DUID = 'duid-1';
const KEY = 'cleaningRun:duid-1';

function makeSnapshot(overrides: Partial<CleaningRunSnapshot> = {}): CleaningRunSnapshot {
	return {
		version: CLEANING_RUN_SNAPSHOT_VERSION,
		duid: DUID,
		savedAtMs: NOW,
		activeMapId: 1,
		areaFingerprint: '1:1:10',
		selectedAreas: [1],
		currentArea: 1,
		progress: [{ areaId: 1, status: ServiceArea.OperationalStatus.Operating }],
		...overrides,
	};
}

interface PersistMocks {
	persist: LocalStorage;
	getItem: ReturnType<typeof vi.fn>;
	setItem: ReturnType<typeof vi.fn>;
	removeItem: ReturnType<typeof vi.fn>;
}

function createPersistMocks(
	overrides: {
		getItem?: ReturnType<typeof vi.fn>;
		setItem?: ReturnType<typeof vi.fn>;
		removeItem?: ReturnType<typeof vi.fn>;
	} = {},
): PersistMocks {
	const getItem = overrides.getItem ?? vi.fn().mockResolvedValue(undefined);
	const setItem = overrides.setItem ?? vi.fn().mockResolvedValue({});
	const removeItem = overrides.removeItem ?? vi.fn().mockResolvedValue({});
	const persist = createMockLocalStorage({ getItem, setItem, removeItem });
	return { persist, getItem, setItem, removeItem };
}

describe('CleaningRunStateStore', () => {
	let log: AnsiLogger;
	let mocks: PersistMocks;
	let store: CleaningRunStateStore;

	beforeEach(() => {
		vi.clearAllMocks();
		log = createMockLogger();
		mocks = createPersistMocks();
		store = new CleaningRunStateStore(mocks.persist, log);
	});

	describe('load', () => {
		it('should return the parsed snapshot when a valid value is stored', async () => {
			const stored = makeSnapshot();
			mocks = createPersistMocks({ getItem: vi.fn().mockResolvedValue(stored) });
			store = new CleaningRunStateStore(mocks.persist, log);

			const result = await store.load(DUID);

			expect(mocks.getItem).toHaveBeenCalledWith(KEY);
			expect(result).toEqual(stored);
		});

		it('should return undefined and skip removeItem on a later clear when the key is missing', async () => {
			const result = await store.load(DUID);
			await store.clear(DUID);

			expect(result).toBeUndefined();
			expect(mocks.removeItem).not.toHaveBeenCalled();
		});

		it('should return undefined, warn and remove the key when the stored value is a string', async () => {
			mocks = createPersistMocks({ getItem: vi.fn().mockResolvedValue('garbage') });
			store = new CleaningRunStateStore(mocks.persist, log);

			const result = await store.load(DUID);

			expect(result).toBeUndefined();
			expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('unreadable'));
			expect(mocks.removeItem).toHaveBeenCalledWith(KEY);
		});

		it('should return undefined, warn and remove the key when the stored shape is malformed', async () => {
			mocks = createPersistMocks({ getItem: vi.fn().mockResolvedValue({ version: 1, duid: DUID }) });
			store = new CleaningRunStateStore(mocks.persist, log);

			const result = await store.load(DUID);

			expect(result).toBeUndefined();
			expect(log.warn).toHaveBeenCalled();
			expect(mocks.removeItem).toHaveBeenCalledWith(KEY);
		});

		it('should return undefined without throwing when getItem rejects', async () => {
			mocks = createPersistMocks({ getItem: vi.fn().mockRejectedValue(new Error('disk error')) });
			store = new CleaningRunStateStore(mocks.persist, log);

			await expect(store.load(DUID)).resolves.toBeUndefined();
			expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('disk error'));
		});

		it('should swallow a removeItem rejection during corrupt-value cleanup', async () => {
			mocks = createPersistMocks({
				getItem: vi.fn().mockResolvedValue('garbage'),
				removeItem: vi.fn().mockRejectedValue(new Error('remove failed')),
			});
			store = new CleaningRunStateStore(mocks.persist, log);

			await expect(store.load(DUID)).resolves.toBeUndefined();
		});
	});

	describe('save', () => {
		it('should call setItem with the cleaningRun key on the first save', async () => {
			const snapshot = makeSnapshot();

			await store.save(DUID, snapshot);

			expect(mocks.setItem).toHaveBeenCalledTimes(1);
			expect(mocks.setItem).toHaveBeenCalledWith(KEY, snapshot);
		});

		it('should skip setItem when content is identical and only savedAtMs changed', async () => {
			await store.save(DUID, makeSnapshot({ savedAtMs: NOW }));
			await store.save(DUID, makeSnapshot({ savedAtMs: NOW + 5_000 }));

			expect(mocks.setItem).toHaveBeenCalledTimes(1);
		});

		it('should call setItem again when progress changed', async () => {
			await store.save(DUID, makeSnapshot());
			await store.save(
				DUID,
				makeSnapshot({ progress: [{ areaId: 1, status: ServiceArea.OperationalStatus.Completed }] }),
			);

			expect(mocks.setItem).toHaveBeenCalledTimes(2);
		});

		it('should not throw and warn when setItem rejects', async () => {
			mocks = createPersistMocks({ setItem: vi.fn().mockRejectedValue(new Error('write failed')) });
			store = new CleaningRunStateStore(mocks.persist, log);

			await expect(store.save(DUID, makeSnapshot())).resolves.toBeUndefined();
			expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('write failed'));
		});

		it('should retry the write on the next save after a failed write', async () => {
			mocks = createPersistMocks({
				setItem: vi.fn().mockRejectedValueOnce(new Error('write failed')).mockResolvedValue({}),
			});
			store = new CleaningRunStateStore(mocks.persist, log);

			await store.save(DUID, makeSnapshot());
			await store.save(DUID, makeSnapshot());

			expect(mocks.setItem).toHaveBeenCalledTimes(2);
		});

		it('should track devices independently', async () => {
			await store.save('duid-a', makeSnapshot({ duid: 'duid-a' }));
			await store.save('duid-b', makeSnapshot({ duid: 'duid-b' }));

			expect(mocks.setItem).toHaveBeenCalledTimes(2);
			expect(mocks.setItem).toHaveBeenNthCalledWith(1, 'cleaningRun:duid-a', expect.anything());
			expect(mocks.setItem).toHaveBeenNthCalledWith(2, 'cleaningRun:duid-b', expect.anything());
		});

		it('should skip setItem when content matches the value seeded by a prior load', async () => {
			const stored = makeSnapshot();
			mocks = createPersistMocks({ getItem: vi.fn().mockResolvedValue(stored) });
			store = new CleaningRunStateStore(mocks.persist, log);

			await store.load(DUID);
			await store.save(DUID, makeSnapshot({ savedAtMs: NOW + 1_000 }));

			expect(mocks.setItem).not.toHaveBeenCalled();
		});
	});

	describe('clear', () => {
		it('should call removeItem once after a save', async () => {
			await store.save(DUID, makeSnapshot());

			await store.clear(DUID);

			expect(mocks.removeItem).toHaveBeenCalledTimes(1);
			expect(mocks.removeItem).toHaveBeenCalledWith(KEY);
		});

		it('should not call removeItem again on a second clear', async () => {
			await store.save(DUID, makeSnapshot());
			await store.clear(DUID);

			await store.clear(DUID);

			expect(mocks.removeItem).toHaveBeenCalledTimes(1);
		});

		it('should not throw and warn when removeItem rejects', async () => {
			mocks = createPersistMocks({ removeItem: vi.fn().mockRejectedValue(new Error('remove failed')) });
			store = new CleaningRunStateStore(mocks.persist, log);
			await store.save(DUID, makeSnapshot());

			await expect(store.clear(DUID)).resolves.toBeUndefined();
			expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('remove failed'));
		});

		it('should write again when save runs with identical content after a clear', async () => {
			const snapshot = makeSnapshot();
			await store.save(DUID, snapshot);
			await store.clear(DUID);

			await store.save(DUID, snapshot);

			expect(mocks.setItem).toHaveBeenCalledTimes(2);
		});
	});
});
