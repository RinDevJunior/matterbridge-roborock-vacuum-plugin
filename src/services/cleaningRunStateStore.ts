import type { AnsiLogger } from 'matterbridge/logger';
import type NodePersist from 'node-persist';

import {
	CLEANING_RUN_KEY_PREFIX,
	type CleaningRunSnapshot,
	parseCleaningRunSnapshot,
} from '../share/cleaningRunSnapshot.js';

/** Safe wrapper over node-persist for the running-clean snapshot. No method ever rejects. */
export class CleaningRunStateStore {
	// value: last serialized snapshot (without savedAtMs), or null when known empty
	private readonly lastKnown = new Map<string, string | null>();

	public constructor(
		private readonly persist: NodePersist.LocalStorage,
		private readonly log: AnsiLogger,
	) {}

	public async load(duid: string): Promise<CleaningRunSnapshot | undefined> {
		const key = `${CLEANING_RUN_KEY_PREFIX}${duid}`;
		try {
			const raw: unknown = await this.persist.getItem(key);
			if (raw === undefined || raw === null) {
				this.lastKnown.set(duid, null);
				return undefined;
			}
			const snapshot = parseCleaningRunSnapshot(raw);
			if (snapshot) {
				this.lastKnown.set(duid, this.serialize(snapshot));
				return snapshot;
			}
			this.log.warn(`[${duid}] Saved cleaning state is unreadable, discarding`);
		} catch (error) {
			this.log.warn(
				`[${duid}] Failed to load saved cleaning state: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		this.lastKnown.delete(duid);
		await this.clear(duid);
		return undefined;
	}

	public async save(duid: string, snapshot: CleaningRunSnapshot): Promise<void> {
		try {
			const serialized = this.serialize(snapshot);
			if (this.lastKnown.get(duid) === serialized) return;
			this.lastKnown.set(duid, serialized);
			await this.persist.setItem(`${CLEANING_RUN_KEY_PREFIX}${duid}`, snapshot);
		} catch (error) {
			this.lastKnown.delete(duid);
			this.log.warn(
				`[${duid}] Failed to save cleaning state: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	public async clear(duid: string): Promise<void> {
		try {
			if (this.lastKnown.get(duid) === null) return;
			await this.persist.removeItem(`${CLEANING_RUN_KEY_PREFIX}${duid}`);
			this.lastKnown.set(duid, null);
		} catch (error) {
			this.log.warn(
				`[${duid}] Failed to clear saved cleaning state: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	private serialize(snapshot: CleaningRunSnapshot): string {
		const { savedAtMs: _savedAtMs, ...rest } = snapshot;
		return JSON.stringify(rest);
	}
}
