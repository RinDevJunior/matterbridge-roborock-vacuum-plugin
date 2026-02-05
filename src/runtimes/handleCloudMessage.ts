import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { CloudMessageModel } from '../model/CloudMessageModel.js';
import { hasDockingStationError } from '../model/DockingStationStatus.js';
import { state_to_matter_operational_status, state_to_matter_state } from '../share/function.js';
import { RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { triggerDssError } from './handleLocalMessage.js';
import { debugStringify } from 'matterbridge/logger';
import { Protocol } from '../roborockCommunication/models/index.js';
import { getCleanModeResolver } from '../share/runtimeHelper.js';
import { getSupportedAreas } from '../initialData/getSupportedAreas.js';
import { PlatformRunner } from '../platformRunner.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { AdditionalPropCode } from '../roborockCommunication/enums/index.js';
import { RoborockMatterbridgePlatform } from '../module.js';

/**
 * Process cloud MQTT messages and update robot state.
 * Handles status updates, RPC responses, clean mode changes, and map updates.
 * @deprecated This function is deprecated and will be removed in future versions.
 */
export function handleCloudMessage(data: CloudMessageModel, platform: RoborockMatterbridgePlatform, runner: PlatformRunner, duid: string): void {
  const messageTypes = Object.keys(data.dps).map(Number);
  const robot = platform.registry.getRobot(duid);
  const service = platform.roborockService;
  if (!robot || !service) {
    platform.log.error(`[handleCloudMessage] Robot or RoborockService not found: ${duid}`);
    return;
  }

  // Known: 122, 121, 102,
  // Unknown: 128, 139
  for (const messageType of messageTypes) {
    switch (messageType) {
      case Protocol.status_update: {
        const status = Number(data.dps[messageType]);
        const matterState = state_to_matter_state(status);

        if (matterState) {
          robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(matterState), platform.log);
        }

        const operationalStateId = state_to_matter_operational_status(status);
        if (operationalStateId) {
          const dssHasError = hasDockingStationError(robot.dockStationStatus);
          if (!(dssHasError && triggerDssError(robot, platform))) {
            robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
          }
        }
        break;
      }
      case Protocol.suction_power:
      case Protocol.water_box_mode: {
        if (robot.cleanModeSetting) {
          const resolver = getCleanModeResolver(robot.device.specs.model, platform.configManager.forceRunAtDefault);
          const currentCleanMode = resolver.resolve(robot.cleanModeSetting);

          platform.log.debug(`Clean mode data (cached): ${debugStringify(robot.cleanModeSetting)}`);
          platform.log.debug(`Current clean mode: ${currentCleanMode}`);
          if (currentCleanMode) {
            robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
          }
        } else {
          service
            .getCleanModeData(duid)
            .then((cleanModeData) => {
              if (cleanModeData) {
                robot.cleanModeSetting = cleanModeData;
                const resolver = getCleanModeResolver(robot.device.specs.model, platform.configManager.forceRunAtDefault);
                const currentCleanMode = resolver.resolve(cleanModeData);

                platform.log.debug(`Clean mode data (fetched): ${debugStringify(cleanModeData)}`);
                platform.log.debug(`Current clean mode: ${currentCleanMode}`);
                if (currentCleanMode) {
                  robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
                }
              }
            })
            .catch((error) => {
              platform.log.error(`[handleCloudMessage] Error fetching clean mode data for robot ${duid}: ${error}`);
            });
        }
        break;
      }
      case Protocol.additional_props: {
        platform.log.notice(`[handleCloudMessage] Received additional properties for robot ${duid}: ${debugStringify(data)}`);
        const propCode = Number(data.dps[Protocol.additional_props]);
        platform.log.debug(`[handleCloudMessage] DPS for additional properties: ${propCode}, AdditionalPropCode: ${AdditionalPropCode[propCode]}`);
        if (propCode === AdditionalPropCode.map_change) {
          handleMapChange(robot, platform, duid);
        }
        break;
      }
      case Protocol.back_type: {
        // Protocol.back_type messages are currently not processed as they don't contain
        // actionable state updates. Future implementation may handle dock type changes.
        break;
      }
      default: {
        platform.log.notice(`[handleCloudMessage] Unknown message type ${messageType}, protocol: ${Protocol[messageType]}, message: ${debugStringify(data)}`);
        break;
      }
    }
  }
}

/**
 * Handle map change events from device.
 * Updates supported areas and maps when the device's map configuration changes.
 * @todo Re-implement map change handling when multiple map support is added back.
 */
export function handleMapChange(robot: RoborockVacuumCleaner, platform: RoborockMatterbridgePlatform, duid: string): void {
  // TODO: Re-implement map change handling when multiple map support is added back.
  platform.log.info(`[handleMapChange] Map change detected for robot ${duid}, but handling is not implemented.`);
  // const enableMultipleMap = platform.configManager.isMultipleMapEnabled;
  // if (!enableMultipleMap) return;
  // const { supportedAreas, supportedMaps, roomIndexMap } = getSupportedAreas(robot.homeInfo, platform.log);
  // platform.log.debug(`[handleMapChange] supportedAreas: ${debugStringify(supportedAreas)}`);
  // platform.log.debug(`[handleMapChange] supportedMaps: ${debugStringify(supportedMaps)}`);
  // platform.log.debug(`[handleMapChange] roomIndexMap: `, roomIndexMap);
  // platform.roborockService?.setSupportedAreas(duid, supportedAreas);
  // platform.roborockService?.setSelectedAreas(duid, []);
  // robot.updateAttribute(ServiceArea.Cluster.id, 'supportedAreas', supportedAreas, platform.log);
  // robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], platform.log);
  // robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, platform.log);
  // if (enableMultipleMap) {
  //   platform.roborockService?.setSupportedAreaIndexMap(duid, roomIndexMap);
  //   robot.updateAttribute(ServiceArea.Cluster.id, 'supportedMaps', supportedMaps, platform.log);
  // }
}
