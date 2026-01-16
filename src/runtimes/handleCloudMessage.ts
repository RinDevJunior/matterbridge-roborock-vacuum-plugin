import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { CloudMessageModel } from '../model/CloudMessageModel.js';
import { hasDockingStationError } from '../model/DockingStationStatus.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { AdditionalPropCode, DeviceStatusNotify, Protocol } from '../roborockCommunication/index.js';
import { state_to_matter_operational_status, state_to_matter_state } from '../share/function.js';
import { RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { triggerDssError } from './handleLocalMessage.js';
import { DpsPayload } from '../roborockCommunication/broadcast/model/dps.js';
import { getRoomMapFromDevice, isStatusUpdate } from '../helper.js';
import { debugStringify } from 'matterbridge/logger';
import { CloudMessageResult } from '../roborockCommunication/Zmodel/messageResult.js';
import { NotifyMessageTypes } from '../notifyMessageTypes.js';
import { getCurrentCleanModeFunc } from '../share/runtimeHelper.js';
import { getSupportedAreas } from '../initialData/getSupportedAreas.js';
import { PlatformRunner } from '../platformRunner.js';
import { RoborockVacuumCleaner } from '../rvc.js';

/**
 * Process cloud MQTT messages and update robot state.
 * Handles status updates, RPC responses, clean mode changes, and map updates.
 * @param data - Cloud message containing DPS (Data Point System) payload
 * @param platform - Platform instance for logging and service access
 * @param runner - Platform runner for state updates
 * @param duid - Device unique identifier
 */
export async function handleCloudMessage(data: CloudMessageModel, platform: RoborockMatterbridgePlatform, runner: PlatformRunner, duid: string): Promise<void> {
  const messageTypes = Object.keys(data.dps).map(Number);
  const robot = platform.robots.get(duid);
  if (robot === undefined) {
    platform.log.error(`Robot not found: ${duid}`);
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
          platform.log.debug('Ignore message:', debugStringify(data));
          return;
        }

        let roboStatus: CloudMessageResult | undefined;
        if (Array.isArray(response.result) && response.result.length > 0) {
          roboStatus = response.result[0] as CloudMessageResult;
        }

        if (roboStatus) {
          const message = { ...roboStatus } as DeviceStatusNotify;
          platform.log.debug('rpc_response:', debugStringify(message));
          await runner.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, message, duid, true);
        }
        break;
      }
      case Protocol.suction_power:
      case Protocol.water_box_mode: {
        await platform.roborockService?.getCleanModeData(duid).then((cleanModeData) => {
          if (cleanModeData) {
            const currentCleanMode = getCurrentCleanModeFunc(
              robot.device.data.model,
              platform.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false,
            )({
              suctionPower: cleanModeData.suctionPower,
              waterFlow: cleanModeData.waterFlow,
              distance_off: cleanModeData.distance_off,
              mopRoute: cleanModeData.mopRoute,
            });

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
        platform.log.notice(`Received additional properties for robot ${duid}: ${debugStringify(data)}`);
        const propCode = data.dps[Protocol.additional_props] as number;
        platform.log.debug(`DPS for additional properties: ${propCode}, AdditionalPropCode: ${AdditionalPropCode[propCode]}`);
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
        platform.log.notice(`Unknown message type ${messageType}, protocol: ${Protocol[messageType]}, message: ${debugStringify(data)}`);
        break;
      }
    }
  }
}

/**
 * Handle map change events from device.
 * Updates supported areas and maps when the device's map configuration changes.
 * @param robot - Robot vacuum cleaner instance
 * @param platform - Platform instance
 * @param duid - Device unique identifier
 */
export async function handleMapChange(robot: RoborockVacuumCleaner, platform: RoborockMatterbridgePlatform, duid: string): Promise<void> {
  const enableMultipleMap = (platform.enableExperimentalFeature?.enableExperimentalFeature && platform.enableExperimentalFeature?.advancedFeature?.enableMultipleMap) ?? false;
  if (!enableMultipleMap) return;

  await getRoomMapFromDevice(robot.device, platform).then((roomMap) => {
    const { supportedAreas, supportedMaps, roomIndexMap } = getSupportedAreas(robot.device.rooms, roomMap, enableMultipleMap, platform.log);

    platform.log.debug(`handleMapChange - supportedAreas: ${debugStringify(supportedAreas)}`);
    platform.log.debug(`handleMapChange - supportedMaps: ${debugStringify(supportedMaps)}`);
    platform.log.debug(`handleMapChange - roomIndexMap: `, roomIndexMap);

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
