import { debugStringify } from 'matterbridge/logger';
import { RvcOperationalState } from 'matterbridge/matter/clusters';

import { DockStationStatus } from '../../model/DockStationStatus.js';
import { VacuumStatus } from '../../model/VacuumStatus.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { DockErrorCode } from '../../roborockCommunication/enums/index.js';
import type { DeviceErrorMessage } from '../../roborockCommunication/models/index.js';
import { getOperationalErrorName } from '../../share/matterStateNames.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

export async function handleErrorOccurred(
	robot: RoborockVacuumCleaner,
	message: DeviceErrorMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	platform.log.debug(`Handling error occurred: ${debugStringify(message)}`);
	if (!platform.configManager.includeVacuumErrorStatus) {
		platform.log.debug(
			`Skipping error handling: includeVacuumErrorStatus is disabled, message: ${debugStringify(message)}`,
		);
		return;
	}

	// highest priority: vacuum errors
	const vacuumStatus = new VacuumStatus(message.vacuumErrorCode ?? 0);
	if (vacuumStatus.hasError()) {
		const errorDetail = vacuumStatus.getErrorState();
		platform.log.warn(`Vacuum error detected: ${getOperationalErrorName(errorDetail)}`);
		await Promise.all([
			robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalState',
				RvcOperationalState.OperationalState.Error,
				platform.log,
			),
			robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalError',
				{ errorStateId: errorDetail },
				platform.log,
			),
		]);
		return;
	}

	// If vacuum is running with no errors, clear any previous errors and skip dock processing
	const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
		RvcOperationalState.Cluster.id,
		'operationalState',
		platform.log,
	);
	if (currentOperationState === RvcOperationalState.OperationalState.Running) {
		platform.log.debug('Vacuum running without errors, clearing error state.');
		await robot.updateAttribute(
			RvcOperationalState.Cluster.id,
			'operationalError',
			{ errorStateId: RvcOperationalState.ErrorState.NoError },
			platform.log,
		);
		return;
	}

	if (!platform.configManager.includeDockStationStatus) {
		return;
	}

	if (message.dockStationStatus != null) {
		// Process dock station errors (only when vacuum not running)
		const dockStatus = DockStationStatus.parseDockStationStatus(message.dockStationStatus);
		robot.dockStationStatus = dockStatus;

		if (dockStatus.hasError()) {
			const errorDetail = dockStatus.getMatterOperationalError();
			platform.log.warn(`Docking station error detected: ${getOperationalErrorName(errorDetail)}`);
			await Promise.all([
				robot.updateAttribute(
					RvcOperationalState.Cluster.id,
					'operationalState',
					RvcOperationalState.OperationalState.Error,
					platform.log,
				),
				robot.updateAttribute(
					RvcOperationalState.Cluster.id,
					'operationalError',
					{ errorStateId: errorDetail },
					platform.log,
				),
			]);
		} else {
			platform.log.debug('No docking station errors detected.');
			await robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalError',
				{ errorStateId: RvcOperationalState.ErrorState.NoError },
				platform.log,
			);
		}
		return;
	}

	if (message.dockErrorCode !== DockErrorCode.None) {
		const dockStatus = DockStationStatus.parseDockErrorCode(message.dockErrorCode);
		if (dockStatus !== RvcOperationalState.ErrorState.NoError) {
			platform.log.warn(`Docking station error detected: ${getOperationalErrorName(dockStatus)}`);
			await robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalError',
				{ errorStateId: dockStatus },
				platform.log,
			);
		} else {
			platform.log.debug('No docking station errors detected.');
			await robot.updateAttribute(
				RvcOperationalState.Cluster.id,
				'operationalError',
				{ errorStateId: RvcOperationalState.ErrorState.NoError },
				platform.log,
			);
		}

		return;
	}

	// No errors detected and no dock station processing
	platform.log.debug('No errors detected, clearing operational error state.');
	await robot.updateAttribute(
		RvcOperationalState.Cluster.id,
		'operationalError',
		{ errorStateId: RvcOperationalState.ErrorState.NoError },
		platform.log,
	);
}
