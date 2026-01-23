/**
 * Platform state container.
 * Holds ephemeral runtime state for the platform (device states, last home data).
 * Uses strict types (no `any`) and provides simple accessor/mutator API.
 */

export type DeviceState = Record<string, unknown>;
export type HomeData = Record<string, unknown>;

export class PlatformState {
  private readonly deviceStates = new Map<string, DeviceState>();
  private readonly lastHomeData = new Map<string, HomeData>();
  private startupCompleted = false;

  // ─── Startup State ──────────────────────────────────────────────────────────

  public get isStartupCompleted(): boolean {
    return this.startupCompleted;
  }

  public setStartupCompleted(completed: boolean): void {
    this.startupCompleted = completed;
  }

  // ─── Device State ───────────────────────────────────────────────────────────

  public setDeviceState(duid: string, state: DeviceState): void {
    if (!duid) return;
    this.deviceStates.set(duid, state);
  }

  public getDeviceState(duid: string): DeviceState | undefined {
    return this.deviceStates.get(duid);
  }

  public updateDeviceState(duid: string, patch: Partial<DeviceState>): void {
    if (!duid) return;
    const existing = this.deviceStates.get(duid) ?? {};
    this.deviceStates.set(duid, { ...existing, ...patch });
  }

  public setLastHomeData(duid: string, data: HomeData): void {
    if (!duid) return;
    this.lastHomeData.set(duid, data);
  }

  public getLastHomeData(duid: string): HomeData | undefined {
    return this.lastHomeData.get(duid);
  }

  public clearDevice(duid: string): void {
    this.deviceStates.delete(duid);
    this.lastHomeData.delete(duid);
  }

  public clearAll(): void {
    this.deviceStates.clear();
    this.lastHomeData.clear();
  }

  public getAllDeviceStates(): Map<string, DeviceState> {
    return new Map(this.deviceStates);
  }
}
