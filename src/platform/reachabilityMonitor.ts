import type { AnsiLogger } from 'matterbridge/logger';

export interface ReachabilityMonitorDeps {
	isEnabled: () => boolean;
	getDelayMs: () => number;
	getRobotDuids: () => string[];
	apply: (duid: string, reachable: boolean) => Promise<boolean>;
	log: AnsiLogger;
	now?: () => number;
}

interface ReachabilityState {
	reachable: boolean;
	lastAliveAt: number | null;
	trackedSince: number;
}

/**
 * Tracks per-device proof of life and flips Matter `reachable`.
 * Going unreachable waits for the configured silence delay; any proof of life restores reachable immediately.
 */
export class ReachabilityMonitor {
	private readonly states = new Map<string, ReachabilityState>();
	private readonly now: () => number;

	constructor(private readonly deps: ReachabilityMonitorDeps) {
		this.now = deps.now ?? (() => Date.now());
	}

	public markAlive(duid: string): void {
		if (!this.deps.isEnabled()) return;

		const now = this.now();
		const state = this.getOrTrack(duid, now);
		state.lastAliveAt = now;
		if (state.reachable) return;

		state.reachable = true;
		void this.applyReachable(duid, true, false);
	}

	public applyCloudStatus(devices: readonly { duid: string; online: boolean }[]): void {
		if (!this.deps.isEnabled()) return;

		for (const device of devices) {
			if (device.online) this.markAlive(device.duid);
		}
	}

	public sweep(): void {
		if (!this.deps.isEnabled()) return;

		const now = this.now();
		const delayMs = this.deps.getDelayMs();
		const duids = new Set(this.deps.getRobotDuids());

		for (const duid of this.states.keys()) {
			if (!duids.has(duid)) this.states.delete(duid);
		}

		for (const duid of duids) {
			const state = this.getOrTrack(duid, now);
			if (!state.reachable) continue;

			const lastProofAt = state.lastAliveAt ?? state.trackedSince;
			if (now - lastProofAt < delayMs) continue;

			state.reachable = false;
			void this.applyReachable(duid, false, true);
		}
	}

	public isReachable(duid: string): boolean {
		return this.states.get(duid)?.reachable ?? true;
	}

	public reset(): void {
		this.states.clear();
	}

	private getOrTrack(duid: string, now: number): ReachabilityState {
		const existing = this.states.get(duid);
		if (existing) return existing;

		const state: ReachabilityState = { reachable: true, lastAliveAt: null, trackedSince: now };
		this.states.set(duid, state);
		return state;
	}

	private async applyReachable(duid: string, reachable: boolean, previous: boolean): Promise<void> {
		let written = false;
		try {
			written = await this.deps.apply(duid, reachable);
		} catch (error) {
			this.deps.log.warn(
				`[${duid}] Failed to set reachable=${reachable}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		if (written) return;

		const state = this.states.get(duid);
		if (state) state.reachable = previous;
	}
}
