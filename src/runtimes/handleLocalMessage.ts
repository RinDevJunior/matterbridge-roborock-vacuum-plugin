import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { CloudMessageResult } from '../roborockCommunication/Zmodel/messageResult.js';
import { state_to_matter_state } from '../share/function.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { OperationStatusCode } from '../roborockCommunication/Zenum/operationStatusCode.js';
import { getRoomMap } from '../helper.js';
import { debugStringify } from 'matterbridge/logger';
import { getBatteryState, getBatteryStatus } from '../initialData/index.js';
import { getCurrentCleanModeFunc } from '../share/runtimeHelper.js';
import { RoborockVacuumCleaner } from '../rvc.js';
import { hasDockingStationError, parseDockingStationStatus } from '../model/DockingStationStatus.js';
import { INVALID_SEGMENT_ID } from '../constants/index.js';

/**
 * Process local network messages and update robot attributes.
 * Handles run mode, battery level, clean mode settings, and area mapping.
 * @param data - Message result from local network communication
 * @param platform - Platform instance for logging and service access
 * @param duid - Device unique identifier (defaults to empty string)
 */
export async function handleLocalMessage(data: CloudMessageResult, platform: RoborockMatterbridgePlatform, duid = ''): Promise<void> {
  const robot = platform.robots.get(duid);

  if (!robot) {
    platform.log.error(`Robot not found: ${duid}`);
    return;
  }

  const currentMappedAreas = platform.roborockService?.getSupportedAreas(duid);
  const roomIndexMap = platform.roborockService?.getSupportedAreasIndexMap(duid);
  const roomMap = await getRoomMap(duid, platform);
  platform.log.debug(`RoomMap: ${roomMap ? debugStringify(roomMap) : 'undefined'}`);
  platform.log.debug(`Current mapped areas: ${currentMappedAreas ? debugStringify(currentMappedAreas) : 'undefined'}`);
  platform.log.debug(
    `RoomIndexMap:
    `,
    roomIndexMap,
  );

  const deviceData = robot.device.data;
  const state = state_to_matter_state(data.state);
  if (state) {
    robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), platform.log);
  }

  if (data.state === OperationStatusCode.Idle) {
    const selectedAreas = platform.roborockService?.getSelectedAreas(duid) ?? [];
    robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, platform.log);
  }

  if (state === RvcRunMode.ModeTag.Cleaning && !data.cleaning_info) {
    platform.log.debug('No cleaning_info, setting currentArea to null');
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, platform.log);
    robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], platform.log);
  } else {
    const isMultipleMapEnable = platform.enableExperimentalFeature?.enableExperimentalFeature && platform.enableExperimentalFeature?.advancedFeature?.enableMultipleMap;
    if (isMultipleMapEnable) {
      await mapRoomsToAreasFeatureOn(platform, duid, data);
    } else {
      await mapRoomsToAreasFeatureOff(platform, duid, data);
    }
  }

  if (data.battery) {
    const batteryLevel = data.battery as number;
    robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
    robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(data.state, data.battery), platform.log);
    robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
  }

  const currentCleanModeSetting = {
    suctionPower: data.cleaning_info?.fan_power ?? data.fan_power,
    waterFlow: data.cleaning_info?.water_box_status ?? data.water_box_mode,
    distance_off: data.distance_off,
    mopRoute: data.cleaning_info?.mop_mode ?? data.mop_mode,
    segment_id: data.cleaning_info?.segment_id,
    target_segment_id: data.cleaning_info?.target_segment_id,
  };

  platform.log.debug(`data: ${debugStringify(data)}`);
  platform.log.debug(`currentCleanModeSetting: ${debugStringify(currentCleanModeSetting)}`);

  if (currentCleanModeSetting.mopRoute && currentCleanModeSetting.suctionPower && currentCleanModeSetting.waterFlow) {
    const currentCleanMode = getCurrentCleanModeFunc(deviceData.model, platform.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false)(currentCleanModeSetting);
    platform.log.debug(`Current clean mode: ${currentCleanMode}`);

    if (currentCleanMode) {
      robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
    }
  }

  processAdditionalProps(robot, data, duid, platform);
}

/**
 * Trigger docking station status error if conditions are met.
 * Checks current operational state and updates to Error state if appropriate.
 * @param robot - Robot vacuum cleaner instance
 * @param platform - Platform instance for logging
 * @returns True if error was triggered, false otherwise
 */
export function triggerDssError(robot: RoborockVacuumCleaner, platform: RoborockMatterbridgePlatform): boolean {
  const currentOperationState = robot.getAttribute(RvcOperationalState.Cluster.id, 'operationalState') as RvcOperationalState.OperationalState;
  if (currentOperationState === RvcOperationalState.OperationalState.Error) {
    return true;
  }

  if (currentOperationState === RvcOperationalState.OperationalState.Docked) {
    robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, platform.log);
    return true;
  }

  return false;
}

async function processAdditionalProps(robot: RoborockVacuumCleaner, message: CloudMessageResult, duid: string, platform: RoborockMatterbridgePlatform): Promise<void> {
  // dss -> DockingStationStatus
  const dssStatus = getDssStatus(message, duid, platform);
  if (dssStatus) {
    triggerDssError(robot, platform);
  }
}

/**
 * Get docking station status from message and update robot state.
 * @param message - Cloud message result containing docking station status
 * @param duid - Device unique identifier
 * @param platform - Platform instance
 * @returns Error operational state if docking station has error, undefined otherwise
 */
function getDssStatus(message: CloudMessageResult, duid: string, platform: RoborockMatterbridgePlatform): RvcOperationalState.OperationalState | undefined {
  const robot = platform.robots.get(duid);
  if (robot === undefined) {
    platform.log.error(`Robot not found: ${duid}`);
    return undefined;
  }

  if (
    platform.enableExperimentalFeature &&
    platform.enableExperimentalFeature.enableExperimentalFeature &&
    platform.enableExperimentalFeature.advancedFeature.includeDockStationStatus &&
    message.dss !== undefined
  ) {
    const dss = parseDockingStationStatus(message.dss);
    if (dss && robot) {
      robot.dockStationStatus = dss;
    }

    if (dss && hasDockingStationError(dss)) {
      return RvcOperationalState.OperationalState.Error;
    }
  }
  return undefined;
}

/**
 * Map room segments to service areas when multiple map feature is disabled.
 * @param platform - Platform instance
 * @param duid - Device unique identifier
 * @param data - Cloud message result with cleaning info
 */
async function mapRoomsToAreasFeatureOff(platform: RoborockMatterbridgePlatform, duid: string, data: CloudMessageResult): Promise<void> {
  const currentMappedAreas = platform.roborockService?.getSupportedAreas(duid);
  const robot = platform.robots.get(duid);
  if (!robot) {
    platform.log.error(`Robot not found: ${duid}`);
    return;
  }

  if (!data.cleaning_info) {
    return;
  }

  const source_segment_id = data.cleaning_info.segment_id ?? INVALID_SEGMENT_ID; // 4
  const source_target_segment_id = data.cleaning_info.target_segment_id ?? INVALID_SEGMENT_ID; // -1
  const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
  const mappedArea = currentMappedAreas?.find((x) => x.areaId == segment_id);
  platform.log.debug(
    `mappedArea:
    source_segment_id: ${source_segment_id},
    source_target_segment_id: ${source_target_segment_id},
    segment_id: ${segment_id},
    result: ${mappedArea ? debugStringify(mappedArea) : 'undefined'}
    `,
  );
  if (segment_id !== INVALID_SEGMENT_ID && mappedArea) {
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', segment_id, platform.log);
  }

  if (segment_id === INVALID_SEGMENT_ID) {
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, platform.log);
  }
}

/**
 * Map room segments to service areas when multiple map feature is enabled.
 * @param platform - Platform instance
 * @param duid - Device unique identifier
 * @param data - Cloud message result with cleaning info
 */
async function mapRoomsToAreasFeatureOn(platform: RoborockMatterbridgePlatform, duid: string, data: CloudMessageResult): Promise<void> {
  const robot = platform.robots.get(duid);
  if (!robot) {
    platform.log.error(`Robot not found: ${duid}`);
    return;
  }

  if (!data.cleaning_info) {
    return;
  }

  const currentMappedAreas = platform.roborockService?.getSupportedAreas(duid);
  const roomIndexMap = platform.roborockService?.getSupportedAreasIndexMap(duid);
  const source_segment_id = data.cleaning_info.segment_id ?? INVALID_SEGMENT_ID; // 4
  const source_target_segment_id = data.cleaning_info.target_segment_id ?? INVALID_SEGMENT_ID; // -1
  const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
  const areaId = roomIndexMap?.getAreaId(segment_id, 0);

  if (!areaId) {
    platform.log.debug(`
      source_segment_id: ${source_segment_id}, 
      source_target_segment_id: ${source_target_segment_id}, 
      segment_id: ${segment_id}, 
      areaId: ${areaId}`);
    return;
  }

  const mappedArea = currentMappedAreas?.find((x) => x.areaId == areaId);
  platform.log.debug(
    `mappedArea:
    source_segment_id: ${source_segment_id},
    source_target_segment_id: ${source_target_segment_id},
    segment_id: ${segment_id},
    areaId: ${areaId},
    result: ${mappedArea ? debugStringify(mappedArea) : 'undefined'}
    `,
  );

  if (areaId !== INVALID_SEGMENT_ID && mappedArea) {
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', areaId, platform.log); // need to be 107
  }
}
