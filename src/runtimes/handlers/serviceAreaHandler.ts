import { debugStringify } from 'matterbridge/logger';
import { RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';

import { INVALID_SEGMENT_ID } from '../../constants/index.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { OperationStatusCode } from '../../roborockCommunication/enums/index.js';
import { computeEstimatedEndTimeFromCleanProgress } from '../../share/estimatedEndTime.js';
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

function buildProgressUpdate(
	existing: ServiceArea.Progress[],
	selectedAreas: number[],
	activeAreaId: number | null,
): ServiceArea.Progress[] {
	const progressMap = new Map<number, ServiceArea.Progress>(existing.map((p) => [p.areaId, p]));

	for (const areaId of selectedAreas) {
		if (!progressMap.has(areaId)) {
			progressMap.set(areaId, {
				areaId,
				status: ServiceArea.OperationalStatus.Pending,
			});
		}
	}

	for (const areaId of progressMap.keys()) {
		if (!selectedAreas.includes(areaId)) {
			progressMap.delete(areaId);
		}
	}

	if (activeAreaId !== null) {
		for (const [areaId, progress] of progressMap.entries()) {
			if (areaId === activeAreaId) {
				progress.status = ServiceArea.OperationalStatus.Operating;
			} else if (progress.status === ServiceArea.OperationalStatus.Operating) {
				progress.status = ServiceArea.OperationalStatus.Completed;
			}
		}
	}

	return Array.from(progressMap.values());
}

export function getNextPendingArea(
	selectedAreas: number[],
	progress: ServiceArea.Progress[],
	afterSkippedId: number,
): number | null {
	const skippedIndex = selectedAreas.indexOf(afterSkippedId);
	if (skippedIndex === -1) {
		return null;
	}

	const progressMap = new Map(progress.map((entry) => [entry.areaId, entry.status]));

	for (let index = skippedIndex + 1; index < selectedAreas.length; index++) {
		const areaId = selectedAreas[index];
		const status = progressMap.get(areaId);
		if (status === undefined || status === ServiceArea.OperationalStatus.Pending) {
			return areaId;
		}
	}

	return null;
}

export function markAreaSkipped(
	progress: ServiceArea.Progress[],
	selectedAreas: number[],
	skippedAreaId: number,
	nextAreaId: number | null,
): ServiceArea.Progress[] {
	const progressMap = new Map<number, ServiceArea.Progress>(progress.map((entry) => [entry.areaId, { ...entry }]));

	for (const areaId of selectedAreas) {
		if (!progressMap.has(areaId)) {
			progressMap.set(areaId, {
				areaId,
				status: ServiceArea.OperationalStatus.Pending,
			});
		}
	}

	const skippedEntry = progressMap.get(skippedAreaId);
	if (skippedEntry) {
		skippedEntry.status = ServiceArea.OperationalStatus.Skipped;
	}

	if (nextAreaId !== null) {
		const nextEntry = progressMap.get(nextAreaId);
		if (nextEntry) {
			nextEntry.status = ServiceArea.OperationalStatus.Operating;
		}
	}

	return Array.from(progressMap.values());
}

async function updateCurrentAreaAndEstimate(
	robot: RoborockVacuumCleaner,
	currentArea: number | null,
	message: ServiceAreaUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;
	await robot.updateAttribute(ServiceArea.id, 'currentArea', currentArea, logger);

	const estimatedEndTime =
		currentArea === null
			? null
			: shouldPublishEstimatedEndTime(platform, message.state)
				? (computeEstimatedEndTimeFromCleanProgress(
						message.cleaningProcess.clean_time,
						message.cleaningProcess.clean_percent,
						currentArea,
					) ?? null)
				: null;

	await robot.updateAttribute(ServiceArea.id, 'estimatedEndTime', estimatedEndTime, logger);
}

function shouldPublishEstimatedEndTime(platform: RoborockMatterbridgePlatform, state: OperationStatusCode): boolean {
	return platform.configManager.isEstimatedEndTimeEnabled && CLEANING_STATES.has(state);
}

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

		const existingProgress = platform.roborockService?.getProgress(robot.device.duid) ?? [];
		const finalProgress = existingProgress.map((p) =>
			p.status === ServiceArea.OperationalStatus.Operating
				? { ...p, status: ServiceArea.OperationalStatus.Completed }
				: p,
		);
		platform.roborockService?.setProgress(robot.device.duid, finalProgress);
		await robot.updateAttribute(ServiceArea.id, 'progress', finalProgress, logger);
		await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
		await robot.updateAttribute(ServiceArea.id, 'estimatedEndTime', null, logger);
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

	await resolveAreaFromCleaningInfo(robot, message, platform);
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
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		await updateCurrentAreaAndEstimate(robot, null, message, platform);
		return;
	}

	if (selectedAreas.length === 1) {
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		await updateCurrentAreaAndEstimate(robot, selectedAreas[0], message, platform);

		const existingProgress = platform.roborockService?.getProgress(robot.device.duid) ?? [];
		const updatedProgress = buildProgressUpdate(existingProgress, selectedAreas, selectedAreas[0]);
		platform.roborockService?.setProgress(robot.device.duid, updatedProgress);
		await robot.updateAttribute(ServiceArea.id, 'progress', updatedProgress, logger);
	} else if (selectedAreas.length > 1 && message.cleaningProcess.clean_time > 0) {
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', selectedAreas, logger);
		await updateCurrentAreaAndEstimate(robot, selectedAreas[0], message, platform);

		const existingProgress = platform.roborockService?.getProgress(robot.device.duid) ?? [];
		const updatedProgress = buildProgressUpdate(existingProgress, selectedAreas, selectedAreas[0]);
		platform.roborockService?.setProgress(robot.device.duid, updatedProgress);
		await robot.updateAttribute(ServiceArea.id, 'progress', updatedProgress, logger);
	} else {
		await robot.updateAttribute(ServiceArea.id, 'selectedAreas', [], logger);
		await updateCurrentAreaAndEstimate(robot, null, message, platform);
	}
}

export async function handleActiveMapChanged(
	robot: RoborockVacuumCleaner,
	mapId: number,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;

	const operationalState: RvcOperationalState.OperationalState | undefined = robot.getAttribute(
		RvcOperationalState.id,
		'operationalState',
		logger,
	);
	const isActivelyCleaning =
		operationalState !== undefined &&
		operationalState !== RvcOperationalState.OperationalState.Docked &&
		operationalState !== RvcOperationalState.OperationalState.Stopped &&
		operationalState !== RvcOperationalState.OperationalState.Error;
	if (isActivelyCleaning) {
		logger.debug(
			`[${robot.device.duid}] ActiveMapChanged: ignoring map change to ${mapId} while actively cleaning (operationalState=${operationalState})`,
		);
		return;
	}

	let supportedAreas = platform.roborockService?.getSupportedAreas(robot.device.duid) ?? [];
	let areasOnMap = supportedAreas.filter((area) => area.mapId === mapId);

	if (areasOnMap.length === 0) {
		const loaded = await platform.roborockService?.ensureAreasForMap(robot.device.duid, mapId);
		if (loaded) {
			supportedAreas = platform.roborockService?.getSupportedAreas(robot.device.duid) ?? [];
			areasOnMap = supportedAreas.filter((area) => area.mapId === mapId);
		}
	}
	if (areasOnMap.length === 0) {
		logger.debug(`[${robot.device.duid}] ActiveMapChanged: no areas found for mapId ${mapId}`);
		return;
	}

	const allAreaIds = areasOnMap.map((area) => area.areaId);
	const matterAreas: ServiceArea.Area[] = robot.getAttribute(ServiceArea.id, 'supportedAreas', logger) ?? [];
	const validAreaIds = allAreaIds.filter((id) => matterAreas.some((a) => a.areaId === id));

	if (validAreaIds.length === 0) {
		logger.debug(
			`[${robot.device.duid}] ActiveMapChanged: no Matter-supported areas match mapId ${mapId} — skipping selectedAreas update`,
		);
		return;
	}

	logger.debug(
		`[${robot.device.duid}] ActiveMapChanged: setting selectedAreas to [${validAreaIds.join(', ')}] and currentArea to null (mapId ${mapId})`,
	);
	await robot.updateAttribute(ServiceArea.id, 'selectedAreas', validAreaIds, logger);
	await robot.updateAttribute(ServiceArea.id, 'currentArea', null, logger);
	await robot.updateAttribute(ServiceArea.id, 'estimatedEndTime', null, logger);

	platform.roborockService?.setProgress(robot.device.duid, []);
	await robot.updateAttribute(ServiceArea.id, 'progress', [], logger);
}

async function resolveAreaFromCleaningInfo(
	robot: RoborockVacuumCleaner,
	message: ServiceAreaUpdateMessage,
	platform: RoborockMatterbridgePlatform,
): Promise<void> {
	const logger = platform.log;
	const cleaningInfo = message.cleaningInfo;
	if (!cleaningInfo) {
		return;
	}

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
	const mappedArea =
		roomIndexMap.getAreaId(segmentId, robot.homeInFo.activeMapId) ?? roomIndexMap.getAreaIdV2(segmentId);

	if (!mappedArea) {
		logger.debug(
			`No mapped area found, skipping area mapping.
        sourceSegmentId: ${sourceSegmentId},
        sourceTargetSegmentId: ${sourceTargetSegmentId},
        segmentId: ${segmentId},
        currentMappedAreas: ${debugStringify(roomIndexMap)}`,
		);
		await updateCurrentAreaAndEstimate(robot, null, message, platform);
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

	await updateCurrentAreaAndEstimate(robot, mappedArea, message, platform);

	const selectedAreas = robot.getAttribute(ServiceArea.id, 'selectedAreas', logger) ?? [];
	const existingProgress = platform.roborockService.getProgress(robot.device.duid);
	const updatedProgress = buildProgressUpdate(existingProgress, selectedAreas, mappedArea);
	platform.roborockService.setProgress(robot.device.duid, updatedProgress);
	await robot.updateAttribute(ServiceArea.id, 'progress', updatedProgress, logger);
}
