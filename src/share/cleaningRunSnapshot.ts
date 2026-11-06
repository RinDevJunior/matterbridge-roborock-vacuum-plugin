import { ServiceArea } from 'matterbridge/matter/clusters';

import type { RoomIndexMap } from '../core/application/models/RoomIndexMap.js';
import { ProtocolVersion } from '../roborockCommunication/enums/index.js';

export const CLEANING_RUN_SNAPSHOT_VERSION = 1;
export const CLEANING_RUN_SNAPSHOT_MAX_AGE_MS = 3 * 60 * 60 * 1000;
export const CLEANING_RUN_KEY_PREFIX = 'cleaningRun:';

const FUTURE_TOLERANCE_MS = 60_000;

const SUPPORTED_PERSIST_PROTOCOLS: ReadonlySet<string> = new Set([ProtocolVersion.V1]);

/** Single guard for which protocols may save/restore a cleaning run. Add protocols here once tested. */
export function isCleaningRunPersistenceSupported(protocolVersion: string | undefined): boolean {
	return protocolVersion !== undefined && SUPPORTED_PERSIST_PROTOCOLS.has(protocolVersion);
}

const OPERATIONAL_STATUS_VALUES: ReadonlySet<number> = new Set(
	Object.values(ServiceArea.OperationalStatus).filter((value): value is number => typeof value === 'number'),
);

export interface PersistedProgressRow {
	areaId: number;
	status: ServiceArea.OperationalStatus;
}

export interface CleaningRunSnapshot {
	version: 1;
	duid: string;
	savedAtMs: number;
	activeMapId: number;
	areaFingerprint: string;
	selectedAreas: number[];
	currentArea: number | null;
	progress: PersistedProgressRow[];
}

export interface RestoredRunSeed {
	activeMapId: number;
	selectedAreas: number[];
	currentArea: number | null;
	progress: ServiceArea.Progress[];
}

export function buildAreaFingerprint(
	areas: ServiceArea.Area[],
	indexMap: RoomIndexMap | undefined,
): string | undefined {
	if (!indexMap || areas.length === 0) return undefined;

	const parts: string[] = [];
	for (const area of areas) {
		const roomId = indexMap.getRoomId(area.areaId);
		if (roomId === undefined) return undefined;
		parts.push(`${area.mapId}:${area.areaId}:${roomId}`);
	}
	return parts.sort().join('|');
}

export function buildCleaningRunSnapshot(input: {
	duid: string;
	nowMs: number;
	activeMapId: number;
	areaFingerprint: string;
	selectedAreas: number[];
	currentArea: number | null;
	progress: ServiceArea.Progress[];
}): CleaningRunSnapshot {
	return {
		version: CLEANING_RUN_SNAPSHOT_VERSION,
		duid: input.duid,
		savedAtMs: input.nowMs,
		activeMapId: input.activeMapId,
		areaFingerprint: input.areaFingerprint,
		selectedAreas: [...input.selectedAreas],
		currentArea: input.currentArea,
		progress: input.progress.map(({ areaId, status }) => ({ areaId, status })),
	};
}

function isIntegerArray(value: unknown): value is number[] {
	return Array.isArray(value) && value.every((item) => Number.isInteger(item));
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseProgressRows(value: unknown): PersistedProgressRow[] | undefined {
	if (!Array.isArray(value)) return undefined;

	const rows: PersistedProgressRow[] = [];
	for (const row of value as unknown[]) {
		if (!isRecord(row)) return undefined;
		const { areaId, status } = row;
		if (typeof areaId !== 'number' || !Number.isInteger(areaId)) return undefined;
		if (typeof status !== 'number' || !OPERATIONAL_STATUS_VALUES.has(status)) return undefined;
		rows.push({ areaId, status: status });
	}
	return rows;
}

export function parseCleaningRunSnapshot(raw: unknown): CleaningRunSnapshot | undefined {
	try {
		if (!isRecord(raw)) return undefined;

		const { version, duid, savedAtMs, activeMapId, areaFingerprint, selectedAreas, currentArea, progress } = raw;
		if (typeof version !== 'number' || !Number.isInteger(version)) return undefined;
		if (typeof duid !== 'string') return undefined;
		if (typeof savedAtMs !== 'number' || !Number.isFinite(savedAtMs)) return undefined;
		if (typeof activeMapId !== 'number' || !Number.isInteger(activeMapId)) return undefined;
		if (typeof areaFingerprint !== 'string') return undefined;
		if (!isIntegerArray(selectedAreas)) return undefined;
		if (currentArea !== null && (typeof currentArea !== 'number' || !Number.isInteger(currentArea))) return undefined;
		const rows = parseProgressRows(progress);
		if (!rows) return undefined;

		return {
			version: version as 1,
			duid,
			savedAtMs,
			activeMapId,
			areaFingerprint,
			selectedAreas,
			currentArea,
			progress: rows,
		};
	} catch {
		return undefined;
	}
}

export function validateSnapshotForRestore(
	snapshot: CleaningRunSnapshot,
	ctx: { duid: string; nowMs: number; supportedAreas: ServiceArea.Area[]; areaFingerprint: string | undefined },
): { ok: true; seed: RestoredRunSeed } | { ok: false; reason: string } {
	if (snapshot.version !== CLEANING_RUN_SNAPSHOT_VERSION) return { ok: false, reason: 'unsupported version' };
	if (snapshot.duid !== ctx.duid) return { ok: false, reason: 'device mismatch' };
	if (ctx.areaFingerprint === undefined || ctx.areaFingerprint !== snapshot.areaFingerprint) {
		return { ok: false, reason: 'room list changed' };
	}
	if (snapshot.savedAtMs > ctx.nowMs + FUTURE_TOLERANCE_MS) return { ok: false, reason: 'saved in the future' };
	if (ctx.nowMs - snapshot.savedAtMs > CLEANING_RUN_SNAPSHOT_MAX_AGE_MS)
		return { ok: false, reason: 'snapshot too old' };

	const knownIds = new Set(ctx.supportedAreas.map((area) => area.areaId));
	const progressIds = snapshot.progress.map((row) => row.areaId);
	if (new Set(snapshot.selectedAreas).size !== snapshot.selectedAreas.length) {
		return { ok: false, reason: 'duplicate selected areas' };
	}
	if (new Set(progressIds).size !== progressIds.length) return { ok: false, reason: 'duplicate progress rows' };

	const referencedIds = [...snapshot.selectedAreas, ...progressIds];
	if (snapshot.currentArea !== null) referencedIds.push(snapshot.currentArea);
	if (referencedIds.some((id) => !knownIds.has(id))) return { ok: false, reason: 'unknown area id' };
	if (snapshot.selectedAreas.length === 0 && snapshot.progress.length === 0) return { ok: false, reason: 'empty run' };

	return {
		ok: true,
		seed: {
			activeMapId: snapshot.activeMapId,
			selectedAreas: [...snapshot.selectedAreas],
			currentArea: snapshot.currentArea,
			progress: snapshot.progress.map(({ areaId, status }) => ({ areaId, status })),
		},
	};
}
