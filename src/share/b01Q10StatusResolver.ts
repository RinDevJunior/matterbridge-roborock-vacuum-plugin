import { B01Q10OperationStatusCode, ProtocolVersion } from '../roborockCommunication/enums/index.js';
import type { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

/**
 * True only when `robot` is a B01/Q10 device — protocol version B01 AND the model's short
 * code (last segment after '.') starts with 'ss'. Mirrors the Q10-detection pattern used in
 * `dispatcherFactory.ts` (intentionally duplicated, not shared, to avoid touching that
 * separately-tested function).
 */
export function isB01Q10Robot(robot: RoborockVacuumCleaner): boolean {
	if (robot.device.pv !== ProtocolVersion.B01) {
		return false;
	}

	const shortModelCode = robot.device.specs.model?.split('.').at(-1);
	return shortModelCode !== undefined && shortModelCode.startsWith('ss');
}

/** True only for B01/Q10 raw status codes that represent actively cleaning. */
export function isB01Q10CleaningState(state: number): boolean {
	return (
		state === B01Q10OperationStatusCode.Sweeping ||
		state === B01Q10OperationStatusCode.SweepAndMop ||
		state === B01Q10OperationStatusCode.Relocating ||
		state === B01Q10OperationStatusCode.Mopping
	);
}

/** True only for B01/Q10 raw status codes that represent idle/docked. */
export function isB01Q10IdleState(state: number): boolean {
	return state === B01Q10OperationStatusCode.Transitioning;
}
