import { HepaFilterMonitoring } from 'matterbridge/matter/clusters';

import { computeFilterChangeIndication, computeFilterConditionPercent } from '../../model/ConsumableStatus.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export interface ConsumableUpdateMessage {
	duid: string;
	filterWorkTimeSec: number;
}

export async function handleConsumableUpdate(
	robot: RoborockVacuumCleaner,
	data: ConsumableUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const conditionPercent = computeFilterConditionPercent(data.filterWorkTimeSec);
	const changeIndication = computeFilterChangeIndication(conditionPercent);

	await Promise.all([
		robot.updateAttribute(HepaFilterMonitoring.id, 'condition', conditionPercent, platform.log),
		robot.updateAttribute(HepaFilterMonitoring.id, 'changeIndication', changeIndication, platform.log),
	]);
}
