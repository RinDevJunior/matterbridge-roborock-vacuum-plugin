import { HepaFilterMonitoring } from 'matterbridge/matter/clusters';

import { computeFilterChangeIndication, resolveFilterConditionPercent } from '../../model/ConsumableStatus.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export interface ConsumableUpdateMessage {
	duid: string;
	filterWorkTimeSec?: number;
	filterConditionPercent?: number;
}

export async function handleConsumableUpdate(
	robot: RoborockVacuumCleaner,
	data: ConsumableUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const conditionPercent = resolveFilterConditionPercent(data);
	const changeIndication = computeFilterChangeIndication(conditionPercent);

	await Promise.all([
		robot.updateAttribute(HepaFilterMonitoring.id, 'condition', conditionPercent, platform.log),
		robot.updateAttribute(HepaFilterMonitoring.id, 'changeIndication', changeIndication, platform.log),
	]);
}
