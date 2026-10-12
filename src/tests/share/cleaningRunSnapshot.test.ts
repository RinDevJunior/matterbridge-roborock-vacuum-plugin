import { ServiceArea } from 'matterbridge/matter/clusters';
import { describe, expect, it, vi } from 'vitest';

import type { RoomIndexMap } from '../../core/application/models/RoomIndexMap.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/index.js';
import {
	buildAreaFingerprint,
	buildCleaningRunSnapshot,
	CLEANING_RUN_KEY_PREFIX,
	CLEANING_RUN_SNAPSHOT_MAX_AGE_MS,
	CLEANING_RUN_SNAPSHOT_VERSION,
	type CleaningRunSnapshot,
	isCleaningRunPersistenceSupported,
	parseCleaningRunSnapshot,
	validateSnapshotForRestore,
} from '../../share/cleaningRunSnapshot.js';
import { asPartial, asType } from '../helpers/testUtils.js';

const NOW = 1_800_000_000_000;
const DUID = 'duid-1';
const FINGERPRINT = '1:0:10|1:1:11|1:2:12';

function makeArea(areaId: number, mapId = 1): ServiceArea.Area {
	return asPartial<ServiceArea.Area>({ areaId, mapId });
}

function makeIndexMap(roomIds: Record<number, number>): RoomIndexMap {
	const lookup = new Map<number, number>(Object.entries(roomIds).map(([k, v]) => [Number(k), v]));
	return asPartial<RoomIndexMap>({ getRoomId: vi.fn((areaId: number) => lookup.get(areaId)) });
}

function makeSnapshot(overrides: Partial<CleaningRunSnapshot> = {}): CleaningRunSnapshot {
	return {
		version: CLEANING_RUN_SNAPSHOT_VERSION,
		duid: DUID,
		savedAtMs: NOW,
		activeMapId: 1,
		areaFingerprint: FINGERPRINT,
		selectedAreas: [1, 2],
		currentArea: 1,
		progress: [
			{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
			{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
		],
		...overrides,
	};
}

function makeContext(overrides: Partial<Parameters<typeof validateSnapshotForRestore>[1]> = {}) {
	return {
		duid: DUID,
		nowMs: NOW,
		supportedAreas: [makeArea(0), makeArea(1), makeArea(2)],
		areaFingerprint: FINGERPRINT,
		...overrides,
	};
}

describe('isCleaningRunPersistenceSupported', () => {
	it('should return true when protocol is V1', () => {
		expect(isCleaningRunPersistenceSupported(ProtocolVersion.V1)).toBe(true);
	});

	it('should return false when protocol is undefined', () => {
		expect(isCleaningRunPersistenceSupported(undefined)).toBe(false);
	});

	it('should return false when protocol is not V1', () => {
		expect(isCleaningRunPersistenceSupported('A01')).toBe(false);
		expect(isCleaningRunPersistenceSupported('B01')).toBe(false);
	});
});

describe('buildAreaFingerprint', () => {
	it('should produce the same fingerprint regardless of area input order', () => {
		const indexMap = makeIndexMap({ 1: 10, 2: 11 });
		const forward = buildAreaFingerprint([makeArea(1), makeArea(2)], indexMap);
		const reversed = buildAreaFingerprint([makeArea(2), makeArea(1)], indexMap);

		expect(forward).toBeDefined();
		expect(forward).toBe(reversed);
	});

	it('should return undefined when indexMap is undefined', () => {
		expect(buildAreaFingerprint([makeArea(1)], undefined)).toBeUndefined();
	});

	it('should return undefined when areas list is empty', () => {
		expect(buildAreaFingerprint([], makeIndexMap({ 1: 10 }))).toBeUndefined();
	});

	it('should return undefined when any area has no roomId (placeholder area)', () => {
		const indexMap = makeIndexMap({ 1: 10 });
		expect(buildAreaFingerprint([makeArea(1), makeArea(2)], indexMap)).toBeUndefined();
	});

	it('should change when the roomId behind the same areaId changes', () => {
		const before = buildAreaFingerprint([makeArea(1)], makeIndexMap({ 1: 10 }));
		const after = buildAreaFingerprint([makeArea(1)], makeIndexMap({ 1: 99 }));

		expect(before).not.toBe(after);
	});

	it('should change when the mapId changes', () => {
		const indexMap = makeIndexMap({ 1: 10 });
		const onMapOne = buildAreaFingerprint([makeArea(1, 1)], indexMap);
		const onMapTwo = buildAreaFingerprint([makeArea(1, 2)], indexMap);

		expect(onMapOne).not.toBe(onMapTwo);
	});

	it('should treat areaId 0 as a valid area (falsy-zero)', () => {
		const fingerprint = buildAreaFingerprint([makeArea(0)], makeIndexMap({ 0: 5 }));

		expect(fingerprint).toBe('1:0:5');
	});
});

describe('buildCleaningRunSnapshot', () => {
	it('should keep only areaId and status for each progress row', () => {
		const snapshot = buildCleaningRunSnapshot({
			duid: DUID,
			nowMs: NOW,
			activeMapId: 1,
			areaFingerprint: FINGERPRINT,
			selectedAreas: [1],
			currentArea: 1,
			progress: [
				asPartial<ServiceArea.Progress>({
					areaId: 1,
					status: ServiceArea.OperationalStatus.Operating,
					estimatedTime: 120,
				}),
			],
		});

		expect(snapshot.progress).toEqual([{ areaId: 1, status: ServiceArea.OperationalStatus.Operating }]);
		expect(snapshot.savedAtMs).toBe(NOW);
		expect(snapshot.version).toBe(CLEANING_RUN_SNAPSHOT_VERSION);
	});

	it('should copy input arrays so later mutation does not alias the snapshot', () => {
		const selectedAreas = [1, 2];
		const progress = [asPartial<ServiceArea.Progress>({ areaId: 1, status: ServiceArea.OperationalStatus.Pending })];

		const snapshot = buildCleaningRunSnapshot({
			duid: DUID,
			nowMs: NOW,
			activeMapId: 1,
			areaFingerprint: FINGERPRINT,
			selectedAreas,
			currentArea: null,
			progress,
		});
		selectedAreas.push(3);
		progress.push(asPartial<ServiceArea.Progress>({ areaId: 2, status: ServiceArea.OperationalStatus.Pending }));

		expect(snapshot.selectedAreas).toEqual([1, 2]);
		expect(snapshot.progress).toHaveLength(1);
	});
});

describe('parseCleaningRunSnapshot', () => {
	it('should round-trip a valid object unchanged', () => {
		const snapshot = makeSnapshot();

		expect(parseCleaningRunSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(snapshot);
	});

	it.each([
		['null', null],
		['a string', 'snapshot'],
		['a number', 42],
		['an array', [1, 2]],
		['an empty object', {}],
	])('should return undefined when input is %s', (_label, raw) => {
		expect(parseCleaningRunSnapshot(raw)).toBeUndefined();
	});

	it('should accept any integer version and leave the version check to validateSnapshotForRestore', () => {
		// Deviation from test-plan: parse only checks Number.isInteger(version); validate rejects != 1.
		const parsed = parseCleaningRunSnapshot({ ...makeSnapshot(), version: 2 });

		expect(parsed?.version).toBe(2);
		expect(validateSnapshotForRestore(asType<CleaningRunSnapshot>(parsed), makeContext())).toEqual({
			ok: false,
			reason: 'unsupported version',
		});
	});

	it('should return undefined when an id is not an integer', () => {
		expect(parseCleaningRunSnapshot({ ...makeSnapshot(), selectedAreas: [1.5] })).toBeUndefined();
		expect(parseCleaningRunSnapshot({ ...makeSnapshot(), activeMapId: 'map' })).toBeUndefined();
	});

	it('should return undefined when a progress status is not a known OperationalStatus value', () => {
		const raw = {
			...makeSnapshot(),
			progress: [{ areaId: 1, status: 99 }],
		};

		expect(parseCleaningRunSnapshot(raw)).toBeUndefined();
	});

	it('should return undefined when progress is missing', () => {
		const { progress: _progress, ...withoutProgress } = makeSnapshot();

		expect(parseCleaningRunSnapshot(withoutProgress)).toBeUndefined();
	});

	it('should return undefined when selectedAreas contains strings', () => {
		expect(parseCleaningRunSnapshot({ ...makeSnapshot(), selectedAreas: ['1', '2'] })).toBeUndefined();
	});

	it('should keep currentArea 0 and null as valid values', () => {
		expect(parseCleaningRunSnapshot({ ...makeSnapshot(), currentArea: 0 })?.currentArea).toBe(0);
		expect(parseCleaningRunSnapshot({ ...makeSnapshot(), currentArea: null })?.currentArea).toBeNull();
	});

	it('should never throw on hostile input whose getter throws', () => {
		const hostile: Record<string, unknown> = {};
		Object.defineProperty(hostile, 'version', {
			get() {
				throw new Error('boom');
			},
		});

		expect(() => parseCleaningRunSnapshot(hostile)).not.toThrow();
		expect(parseCleaningRunSnapshot(hostile)).toBeUndefined();
	});
});

describe('validateSnapshotForRestore', () => {
	it('should return ok with a seed of {areaId,status} rows and activeMapId', () => {
		const result = validateSnapshotForRestore(makeSnapshot(), makeContext());

		expect(result).toEqual({
			ok: true,
			seed: {
				activeMapId: 1,
				selectedAreas: [1, 2],
				currentArea: 1,
				progress: [
					{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
					{ areaId: 2, status: ServiceArea.OperationalStatus.Pending },
				],
			},
		});
	});

	it('should fail with version mismatch reason when snapshot version differs', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ version: asType<1>(2) }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'unsupported version' });
	});

	it('should fail with device mismatch reason when duid differs', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ duid: 'other' }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'device mismatch' });
	});

	it('should fail with room list changed reason when current fingerprint is undefined', () => {
		const result = validateSnapshotForRestore(makeSnapshot(), makeContext({ areaFingerprint: undefined }));

		expect(result).toEqual({ ok: false, reason: 'room list changed' });
	});

	it('should fail with room list changed reason when fingerprint differs', () => {
		const result = validateSnapshotForRestore(makeSnapshot(), makeContext({ areaFingerprint: '1:0:99' }));

		expect(result).toEqual({ ok: false, reason: 'room list changed' });
	});

	it('should fail when snapshot is older than the max age', () => {
		const savedAtMs = NOW - CLEANING_RUN_SNAPSHOT_MAX_AGE_MS - 1;
		const result = validateSnapshotForRestore(makeSnapshot({ savedAtMs }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'snapshot too old' });
	});

	it('should accept a snapshot exactly at the max age boundary', () => {
		const savedAtMs = NOW - CLEANING_RUN_SNAPSHOT_MAX_AGE_MS;
		const result = validateSnapshotForRestore(makeSnapshot({ savedAtMs }), makeContext());

		expect(result.ok).toBe(true);
	});

	it('should fail when savedAtMs is more than 60s in the future', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ savedAtMs: NOW + 60_001 }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'saved in the future' });
	});

	it('should accept savedAtMs within the 60s future tolerance', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ savedAtMs: NOW + 60_000 }), makeContext());

		expect(result.ok).toBe(true);
	});

	it('should fail when a selected area id is missing from supportedAreas', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ selectedAreas: [1, 7] }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'unknown area id' });
	});

	it('should fail when a progress area id is missing from supportedAreas', () => {
		const result = validateSnapshotForRestore(
			makeSnapshot({ progress: [{ areaId: 9, status: ServiceArea.OperationalStatus.Pending }] }),
			makeContext(),
		);

		expect(result).toEqual({ ok: false, reason: 'unknown area id' });
	});

	it('should fail when currentArea is missing from supportedAreas', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ currentArea: 9 }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'unknown area id' });
	});

	it('should accept currentArea null', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ currentArea: null }), makeContext());

		expect(result.ok).toBe(true);
		expect(result.ok && result.seed.currentArea).toBeNull();
	});

	it('should accept areaId 0 as a present id and keep currentArea 0', () => {
		const result = validateSnapshotForRestore(
			makeSnapshot({
				selectedAreas: [0],
				currentArea: 0,
				progress: [{ areaId: 0, status: ServiceArea.OperationalStatus.Operating }],
			}),
			makeContext(),
		);

		expect(result.ok).toBe(true);
		expect(result.ok && result.seed.currentArea).toBe(0);
	});

	it('should fail when selectedAreas contains duplicate ids', () => {
		const result = validateSnapshotForRestore(makeSnapshot({ selectedAreas: [1, 1] }), makeContext());

		expect(result).toEqual({ ok: false, reason: 'duplicate selected areas' });
	});

	it('should fail when progress contains duplicate ids', () => {
		const result = validateSnapshotForRestore(
			makeSnapshot({
				progress: [
					{ areaId: 1, status: ServiceArea.OperationalStatus.Pending },
					{ areaId: 1, status: ServiceArea.OperationalStatus.Operating },
				],
			}),
			makeContext(),
		);

		expect(result).toEqual({ ok: false, reason: 'duplicate progress rows' });
	});

	it('should fail with empty run reason when selectedAreas and progress are both empty', () => {
		const result = validateSnapshotForRestore(
			makeSnapshot({ selectedAreas: [], progress: [], currentArea: null }),
			makeContext(),
		);

		expect(result).toEqual({ ok: false, reason: 'empty run' });
	});
});

describe('CLEANING_RUN_KEY_PREFIX', () => {
	it('should be the prefix used for per-device storage keys', () => {
		expect(CLEANING_RUN_KEY_PREFIX).toBe('cleaningRun:');
	});
});
