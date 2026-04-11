import { debugStringify } from 'matterbridge/logger';
import { RvcCleanMode } from 'matterbridge/matter/clusters';

import { CleanModeSetting } from '../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { CleanSequenceType } from '../../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { getCleanModeName } from '../../share/matterStateNames.js';
import { getCleanModeResolver } from '../../share/runtimeHelper.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export async function handleCleanModeUpdate(
	robot: RoborockVacuumCleaner,
	message: {
		suctionPower: number;
		waterFlow: number;
		distance_off: number;
		mopRoute: number | undefined;
		seq_type: number | undefined;
	},
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	platform.log.debug(`Handling clean mode update: ${debugStringify(message)}`);
	const deviceData = robot.device.specs;

	const currentCleanModeSetting = new CleanModeSetting(
		message.suctionPower,
		message.waterFlow,
		message.distance_off,
		message.mopRoute,
		message.seq_type ?? CleanSequenceType.Persist,
	);
	if (currentCleanModeSetting.hasFullSettings) {
		robot.cleanModeSetting = currentCleanModeSetting;
		const forceRunAtDefault = platform.configManager.forceRunAtDefault;
		const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
		const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);

		if (currentCleanMode) {
			platform.log.notice(`Calculated current clean mode: ${getCleanModeName(currentCleanMode)}`);
			await robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
		}
	}
}
