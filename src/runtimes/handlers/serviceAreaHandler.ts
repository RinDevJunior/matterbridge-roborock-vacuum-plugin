import { debugStringify } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';

import { INVALID_SEGMENT_ID } from '../../constants/index.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import type { CleanInformation } from '../../roborockCommunication/models/messageResult.js';
import type { ServiceAreaUpdateMessage } from '../../types/MessagePayloads.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';

const CLEANING_STATES = new Set([
	OperationStatusCode.RoomClean,
	OperationStatusCode.ZoneClean,
	OperationStatusCode.SpotCleaning,
	OperationStatusCode.RoomMopping,
	OperationStatusCode.ZoneMopping,
	OperationStatusCode.RoomCleanMopCleaning,
	OperationStatusCode.RoomCleanMopMopping,
	OperationStatusCode.ZoneCleanMopCleaning,
	OperationStatusCode.ZoneCleanMopMopping,
	OperationStatusCode.Paused,
	OperationStatusCode.Cleaning,
	OperationStatusCode.Mapping,
	OperationStatusCode.CleanMopCleaning,
	OperationStatusCode.CleanMopMopping,
]);

export async function handleServiceAreaUpdate(
	robot: RoborockVacuumCleaner,
	message: ServiceAreaUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;
	logger.debug(`Handling service area update: ${debugStringify(message)}`);

	if (message.state === OperationStatusCode.Idle) {
		logger.debug('Robot is idle, updating selectedAreas from Roborock service');
		const selectedAreas = platform.roborockService?.getSelectedAreas(robot.device.duid) ?? [];
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		return;
	}

	if (!message.cleaningInfo && CLEANING_STATES.has(message.state)) {
		await handleCleaningWithoutInfo(robot, message, platform);
		return;
	}

	if (!message.cleaningInfo) {
		logger.debug('No cleaning_info available, skipping service area update');
		return;
	}

	await resolveAreaFromCleaningInfo(robot, message.cleaningInfo, platform);
}

function getSelectedAreas(
	robot: RoborockVacuumCleaner,
	message: ServiceAreaUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): number[] {
	return (
		robot.getAttribute(ServiceArea.id, 'selectedAreas', platform.log) ??
		platform.roborockService?.getSelectedAreas(message.duid) ??
		[]
	);
}

async function handleCleaningWithoutInfo(
	robot: RoborockVacuumCleaner,
	message: ServiceAreaUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;
	logger.notice('Vacuum is cleaning with no cleaning_info');

	const selectedAreas = getSelectedAreas(robot, message, platform);

	if (message.cleaningProcess.clean_area === 0 || message.cleaningProcess.clean_time === 0) {
		// Robot not started cleaning yet → "Traveling to room"
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
		return;
	}

	if (selectedAreas.length === 1) {
		// Single room → "Cleaning (Room)"
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		await robot.updateAttribute(ServiceArea.id, 'currentArea', selectedAreas[0], logger);
	} else {
		// Multiple rooms, no cleaningInfo → "Preparing" (workaround)
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', [], logger);
		await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
	}
}

export async function handleActiveMapChanged(
	robot: RoborockVacuumCleaner,
	mapId: number,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;
	const supportedAreas = platform.roborockService?.getSupportedAreas(robot.device.duid) ?? [];
	const areasOnMap = supportedAreas.filter((area) => area.mapId === mapId);

	if (areasOnMap.length === 0) {
		logger.debug(`[${robot.device.duid}] ActiveMapChanged: no areas found for mapId ${mapId}`);
		return;
	}

	const allAreaIds = areasOnMap.map((area) => area.areaId);

	logger.debug(
		`[${robot.device.duid}] ActiveMapChanged: setting selectedAreas to [${allAreaIds.join(', ')}] and currentArea to null (mapId ${mapId})`,
	);
	await robot.updateAttribute(ServiceArea.id, 'selectedAreas', allAreaIds, logger);
	await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
}

async function resolveAreaFromCleaningInfo(
	robot: RoborockVacuumCleaner,
	cleaningInfo: CleanInformation,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;

	const roomIndexMap = platform.roborockService?.getSupportedAreasIndexMap(robot.device.duid);
	if (!roomIndexMap || !platform.roborockService) {
		logger.debug('Room map not yet available, skipping room area resolution');
		return;
	}

	const sourceSegmentId = cleaningInfo.segment_id ?? INVALID_SEGMENT_ID;
	const sourceTargetSegmentId = cleaningInfo.target_segment_id ?? INVALID_SEGMENT_ID;
	const segmentId = sourceSegmentId !== INVALID_SEGMENT_ID ? sourceSegmentId : sourceTargetSegmentId;

	if (segmentId === INVALID_SEGMENT_ID) {
		logger.debug('No active segment, skipping currentArea update');
		return;
	}
	const mappedArea = roomIndexMap.getAreaId(segmentId, robot.homeInFo.activeMapId);

	if (!mappedArea) {
		logger.debug(
			`No mapped area found, skipping area mapping.
        sourceSegmentId: ${sourceSegmentId},
        sourceTargetSegmentId: ${sourceTargetSegmentId},
        segmentId: ${segmentId},
        currentMappedAreas: ${debugStringify(roomIndexMap)}`,
		);
		await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
		return;
	}

	const supportedAreas = platform.roborockService.getSupportedAreas(robot.device.duid);
	logger.debug(
		`Mapped area found:
      sourceSegmentId: ${sourceSegmentId},
      sourceTargetSegmentId: ${sourceTargetSegmentId},
      segmentId: ${segmentId},
      currentMappedAreas: ${debugStringify(roomIndexMap)},
      activeArea: ${debugStringify(supportedAreas.find((x) => x.areaId === mappedArea))}`,
	);

	await robot.updateAttribute(ServiceArea.id, 'currentArea', mappedArea, logger);
}
