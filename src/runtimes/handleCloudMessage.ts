import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { CloudMessageModel } from '../model/CloudMessageModel.js';
import { hasDockingStationError } from '../model/DockingStationStatus.js';
import { state_to_matter_operational_status, state_to_matter_state } from '../share/function.js';
import { RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { triggerDssError } from './handleLocalMessage.js';
import { RoomMap } from '../core/application/models/index.js';
import { isStatusUpdate } from '../share/helper.js';
import { debugStringify } from 'matterbridge/logger';
import { CloudMessageResult, DeviceStatusNotify, DpsPayload, Protocol } from '../roborockCommunication/models/index.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { getCleanModeResolver } from '../share/runtimeHelper.js';
import { getSupportedAreas } from '../initialData/getSupportedAreas.js';
import { PlatformRunner } from '../platformRunner.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { AdditionalPropCode } from '../roborockCommunication/enums/index.js';
import { RoborockMatterbridgePlatform } from '../module.js';

/**
 * Process cloud MQTT messages and update robot state.
 * Handles status updates, RPC responses, clean mode changes, and map updates.
 */
export async function handleCloudMessage(data: CloudMessageModel, platform: RoborockMatterbridgePlatform, runner: PlatformRunner, duid: string): Promise<void> {
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
      case Protocol.rpc_response: {
        const response = data.dps[messageType] as DpsPayload;
        // ignore network info
        if (!isStatusUpdate(response.result)) {
          platform.log.debug(`[handleCloudMessage] Ignore message: ${debugStringify(data)}`);
          return;
        }

        let roboStatus: CloudMessageResult | undefined;
        if (Array.isArray(response.result) && response.result.length > 0) {
          roboStatus = response.result[0] as CloudMessageResult;
        }

        if (roboStatus) {
          const message = { ...roboStatus } as DeviceStatusNotify;
          platform.log.debug(`[handleCloudMessage] rpc_response: ${debugStringify(message)}`);
          await runner.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, message, duid, true);
        }
        break;
      }
      case Protocol.suction_power:
      case Protocol.water_box_mode: {
        await service.getCleanModeData(duid).then((cleanModeData) => {
          if (cleanModeData) {
            const resolver = getCleanModeResolver(robot.device.data.model, platform.configManager.forceRunAtDefault);
            const currentCleanMode = resolver.resolve(cleanModeData);

            platform.log.debug(`Clean mode data: ${debugStringify(cleanModeData)}`);
            platform.log.debug(`Current clean mode: ${currentCleanMode}`);
            if (currentCleanMode) {
              robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
            }
          }
        });
        break; // Do nothing, handled in local message
      }
      case Protocol.additional_props: {
        platform.log.notice(`[handleCloudMessage] Received additional properties for robot ${duid}: ${debugStringify(data)}`);
        const propCode = data.dps[Protocol.additional_props] as number;
        platform.log.debug(`[handleCloudMessage] DPS for additional properties: ${propCode}, AdditionalPropCode: ${AdditionalPropCode[propCode]}`);
        if (propCode === AdditionalPropCode.map_change) {
          await handleMapChange(robot, platform, duid);
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
 */
export async function handleMapChange(robot: RoborockVacuumCleaner, platform: RoborockMatterbridgePlatform, duid: string): Promise<void> {
  const enableMultipleMap = platform.configManager.isMultipleMapEnabled;
  if (!enableMultipleMap) return;

  await RoomMap.fromDeviceDirect(robot.device, platform).then((roomMap) => {
    const { supportedAreas, supportedMaps, roomIndexMap } = getSupportedAreas(robot.device.rooms, roomMap, enableMultipleMap, platform.log, robot.mapInfos ?? []);

    platform.log.debug(`[handleMapChange] supportedAreas: ${debugStringify(supportedAreas)}`);
    platform.log.debug(`[handleMapChange] supportedMaps: ${debugStringify(supportedMaps)}`);
    platform.log.debug(`[handleMapChange] roomIndexMap: `, roomIndexMap);

    platform.roborockService?.setSupportedAreas(duid, supportedAreas);
    platform.roborockService?.setSelectedAreas(duid, []);
    robot.updateAttribute(ServiceArea.Cluster.id, 'supportedAreas', supportedAreas, platform.log);
    robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], platform.log);
    robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, platform.log);

    if (enableMultipleMap) {
      platform.roborockService?.setSupportedAreaIndexMap(duid, roomIndexMap);
      robot.updateAttribute(ServiceArea.Cluster.id, 'supportedMaps', supportedMaps, platform.log);
    }
  });
}
