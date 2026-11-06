/**
 * Q10-only, non-canonical status codes reported by B01/Q10 devices.
 * These numbers are NOT part of the canonical `OperationStatusCode` enum — some of them
 * (e.g. 105) collide numerically with unrelated canonical meanings, so they must never be
 * added there. Classification is resolved by protocol version + device model instead of
 * raw numeric value — see `src/share/b01Q10StatusResolver.ts`.
 */
export enum B01Q10OperationStatusCode {
	/** python-roborock YXDeviceState.SWEEPING — actively cleaning (vacuum only). */
	Sweeping = 102,
	/** python-roborock YXDeviceState.SWEEP_AND_MOP — actively cleaning (vacuum + mop). */
	SweepAndMop = 104,
	/**
	 * python-roborock YXDeviceState.TRANSITIONING; live-capture on Q10 S5+ confirms
	 * idle/docked behavior here — named to match upstream terminology only, NOT
	 * to imply a different runtime meaning. Classification (isB01Q10IdleState)
	 * still treats this as idle/docked — behavior unchanged, see issue #166.
	 */
	Transitioning = 105,
	/**
	 * python-roborock YXDeviceState.RELOCATING/MOPPING — treated as active-cleaning per
	 * user-approved cross-reference to python-roborock; no independent live-capture
	 * confirmation on this plugin's own Q10 S5+ hardware (unlike Sweeping/SweepAndMop/
	 * Transitioning, which are live-capture-confirmed). See issue #166.
	 */
	Relocating = 101,
	Mopping = 103,

	/** NOT CONFIRMED on real hardware — from python-roborock only. Do NOT use in
	 *  classification without live-capture evidence, see issue #166. */
	WaitingToCharge = 108,
	/** NOT CONFIRMED on real hardware — from python-roborock only (YXDeviceState.SAVING_MAP).
	 *  Same documented-only tier as WaitingToCharge above — added after a full-source
	 *  cross-check of YXDeviceState (all members) during this task. Do NOT use in
	 *  classification without live-capture evidence, see issue #166. */
	SavingMap = 99,
}
