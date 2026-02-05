import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { CloudMessageResult } from '../roborockCommunication/models/index.js';
import { state_to_matter_state } from '../share/function.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { OperationStatusCode } from '../roborockCommunication/enums/index.js';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { getBatteryState, getBatteryStatus } from '../initialData/index.js';
import { getCleanModeResolver } from '../share/runtimeHelper.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { hasDockingStationError, parseDockingStationStatus } from '../model/DockingStationStatus.js';
import { INVALID_SEGMENT_ID } from '../constants/index.js';
import { RoborockService } from '../services/roborockService.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';

/**
 * Process local network messages and update robot attributes.
 * Handles run mode, battery level, clean mode settings, and area mapping.
 * @deprecated This function is deprecated and will be removed in future versions.
 */
export function handleLocalMessage(data: CloudMessageResult, platform: RoborockMatterbridgePlatform, duid = ''): void {
  const robot = platform.registry.getRobot(duid);

  if (!robot || !platform.roborockService) {
    platform.log.error(`[handleLocalMessage] Robot or RoborockService not found: ${duid}`);
    return;
  }
  const service = platform.roborockService;

  const currentMappedAreas = service.getSupportedAreas(duid);
  const roomIndexMap = service.getSupportedAreasIndexMap(duid);
  platform.log.debug(
    `Precondition Data:
    Device: ${duid}
    HomeInfo: ${robot.homeInfo ? debugStringify(robot.homeInfo) : 'undefined'}
    Current mapped areas: ${currentMappedAreas ? debugStringify(currentMappedAreas) : 'undefined'}
    RoomIndexMap: ${roomIndexMap ? debugStringify(roomIndexMap) : 'undefined'}
    `,
  );

  const deviceData = robot.device.specs;
  const state = state_to_matter_state(data.state);
  if (state) {
    robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), platform.log);
  }

  if (data.state === OperationStatusCode.Idle) {
    const selectedAreas = service.getSelectedAreas(duid) ?? [];
    robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, platform.log);
  }

  if (state === RvcRunMode.ModeTag.Cleaning && !data.cleaning_info) {
    platform.log.debug('No cleaning_info, setting currentArea to null');
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, platform.log);
    robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], platform.log);
  } else {
    // TODO: Handle multiple map feature toggle
    mapRoomsToAreasFeatureOff(duid, data, service, robot, platform.log);
  }

  if (data.battery) {
    const batteryLevel = data.battery;
    robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
    robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(data.state, data.battery), platform.log);
    robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
  }

  const currentCleanModeSetting = new CleanModeSetting(
    data.cleaning_info?.fan_power ?? data.fan_power,
    data.cleaning_info?.water_box_status ?? data.water_box_mode,
    data.distance_off,
    data.cleaning_info?.mop_mode ?? data.mop_mode,
  );

  platform.log.debug(
    `Message: ${debugStringify(data)}
     Current Clean Mode Setting: ${debugStringify(currentCleanModeSetting)}
     Current segment_id: ${data.cleaning_info?.segment_id}
     Current target_segment_id: ${data.cleaning_info?.target_segment_id}
    `,
  );

  if (currentCleanModeSetting.hasFullSettings) {
    robot.cleanModeSetting = currentCleanModeSetting;
    const forceRunAtDefault = platform.configManager.forceRunAtDefault;
    const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
    const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);
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
 */
function getDssStatus(message: CloudMessageResult, duid: string, platform: RoborockMatterbridgePlatform): RvcOperationalState.OperationalState | undefined {
  const robot = platform.registry.getRobot(duid);
  if (robot === undefined) {
    platform.log.error(`Robot not found: ${duid}`);
    return undefined;
  }

  if (platform.configManager.includeDockStationStatus && message.dss !== undefined) {
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
 */
function mapRoomsToAreasFeatureOff(duid: string, data: CloudMessageResult, roborockService: RoborockService, robot: RoborockVacuumCleaner, logger: AnsiLogger): void {
  if (!data.cleaning_info) {
    logger.debug('No cleaning_info found, skipping area mapping.');
    return;
  }
  const currentMappedAreas = roborockService.getSupportedAreas(duid);

  const source_segment_id = data.cleaning_info.segment_id ?? INVALID_SEGMENT_ID;
  const source_target_segment_id = data.cleaning_info.target_segment_id ?? INVALID_SEGMENT_ID;
  const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
  const mappedArea = currentMappedAreas?.find((x) => x.areaId == segment_id);

  if (!mappedArea) {
    logger.debug(
      `No mapped area found, skipping area mapping.
        source_segment_id: ${source_segment_id}, 
        source_target_segment_id: ${source_target_segment_id}, 
        segment_id: ${segment_id}, 
        mappedArea: ${mappedArea}`,
    );
    return;
  }

  logger.debug(
    `Mapped area found:
      source_segment_id: ${source_segment_id},
      source_target_segment_id: ${source_target_segment_id},
      segment_id: ${segment_id},
      result: ${debugStringify(mappedArea)}
    `,
  );
  if (segment_id !== INVALID_SEGMENT_ID && mappedArea) {
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', segment_id, logger);
  }

  if (segment_id === INVALID_SEGMENT_ID) {
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, logger);
  }
}

/**
 * Map room segments to service areas when multiple map feature is enabled.
 */
// function mapRoomsToAreasFeatureOn(platform: RoborockMatterbridgePlatform, duid: string, data: CloudMessageResult): void {
//   const robot = platform.registry.getRobot(duid);
//   if (!robot) {
//     platform.log.error(`Robot not found: ${duid}`);
//     return;
//   }

//   if (!data.cleaning_info) {
//     platform.log.debug('No cleaning_info found, skipping area mapping.');
//     return;
//   }
//   const service = platform.roborockService;
//   if (!service) {
//     platform.log.error('RoborockService not available.');
//     return;
//   }

//   const currentMappedAreas = service.getSupportedAreas(duid);
//   const roomIndexMap = service.getSupportedAreasIndexMap(duid);
//   const source_segment_id = data.cleaning_info.segment_id ?? INVALID_SEGMENT_ID; // 4
//   const source_target_segment_id = data.cleaning_info.target_segment_id ?? INVALID_SEGMENT_ID; // -1
//   const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
//   const areaId = roomIndexMap?.getAreaId(segment_id, 0);

//   const mappedArea = currentMappedAreas?.find((x) => x.areaId == areaId);

//   if (!areaId || areaId === INVALID_SEGMENT_ID || !mappedArea) {
//     platform.log.debug(
//       `No areaId found, skipping area mapping.
//         source_segment_id: ${source_segment_id},
//         source_target_segment_id: ${source_target_segment_id},
//         segment_id: ${segment_id},
//         areaId: ${areaId}`,
//     );
//     return;
//   }

//   platform.log.debug(
//     `Mapped area found:
//       source_segment_id: ${source_segment_id},
//       source_target_segment_id: ${source_target_segment_id},
//       segment_id: ${segment_id},
//       areaId: ${areaId},
//       result: ${debugStringify(mappedArea)}
//     `,
//   );

//   if (areaId !== INVALID_SEGMENT_ID && mappedArea) {
//     robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', areaId, platform.log); // need to be 107
//   }
// }
