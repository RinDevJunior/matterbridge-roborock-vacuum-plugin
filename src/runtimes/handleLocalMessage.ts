import { RvcOperationalState } from 'matterbridge/matter/clusters';

import { RoborockMatterbridgePlatform } from '../module.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';

/**
 * Trigger docking station status error if conditions are met.
 * Checks current operational state and updates to Error state if appropriate.
 */
export async function triggerDssError(
	robot: RoborockVacuumCleaner,
	platform: RoborockMatterbridgePlatform,
): Promise<boolean> {
	const currentOperationState = robot.getAttribute(
		RvcOperationalState.id,
		'operationalState',
	) as RvcOperationalState.OperationalState;
	if (currentOperationState === RvcOperationalState.OperationalState.Error) {
		return true;
	}

	if (currentOperationState === RvcOperationalState.OperationalState.Docked) {
		await robot.updateAttribute(
			RvcOperationalState.id,
			'operationalState',
			RvcOperationalState.OperationalState.Error,
			platform.log,
		);
		return true;
	}

	return false;
}
