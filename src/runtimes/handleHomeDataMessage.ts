import { PowerSource, RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { getVacuumProperty } from '../share/helper.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { debugStringify } from 'matterbridge/logger';
import { getBatteryState, getBatteryStatus } from '../initialData/index.js';
import { state_to_matter_operational_status, state_to_matter_state } from '../share/function.js';
import { OperationStatusCode } from '../roborockCommunication/enums/index.js';
import { getRunningMode } from '../initialData/getSupportedRunModes.js';
import { hasDockingStationError } from '../model/DockingStationStatus.js';
import { triggerDssError } from './handleLocalMessage.js';
import { Device, Home } from '../roborockCommunication/models/index.js';

/**
 * Update robot states from home data polling response.
 * Synchronizes battery level, charge state, run mode, and operational state from cloud API.
 * @param homeData - Home data from Roborock cloud API containing device states
 * @param platform - Platform instance for robot access and logging
 */
export async function updateFromHomeData(homeData: Home, platform: RoborockMatterbridgePlatform): Promise<void> {
  if (platform.registry.robotsMap.size === 0) return;
  const devices = homeData.devices.filter((d: Device) => platform.registry.robotsMap.has(d.duid));

  for (const device of devices) {
    const robot = platform.registry.getRobot(device.duid);
    if (robot === undefined) {
      platform.log.error(`Robot not found: ${device.duid}`);
      continue;
    }

    const deviceData = robot.device.data;
    if (!device || deviceData === undefined) {
      platform.log.error('Device not found in home data');
      return;
    }

    device.schema = homeData.products.find((prd) => prd.id === device.productId || prd.model === device.data.model)?.schema ?? [];
    platform.log.debug('updateFromHomeData-homeData:', debugStringify(homeData));
    platform.log.debug('updateFromHomeData-device:', debugStringify(device));
    platform.log.debug('updateFromHomeData-schema:' + debugStringify(device.schema));
    platform.log.debug('updateFromHomeData-battery:' + debugStringify(device.deviceStatus));

    const batteryLevel = getVacuumProperty(device, 'battery');
    if (batteryLevel) {
      robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel ? batteryLevel * 2 : 200, platform.log);
      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
    }

    const state = getVacuumProperty(device, 'state');
    const matterState = state_to_matter_state(state);
    if (!state || !matterState) {
      return;
    }
    platform.log.debug(`updateFromHomeData-RvcRunMode code: ${state} name: ${OperationStatusCode[state]}, matterState: ${RvcRunMode.ModeTag[matterState]}`);

    if (matterState) {
      robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(matterState), platform.log);
    }
    if (batteryLevel) {
      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(state, batteryLevel), platform.log);
    }

    const operationalStateId = state_to_matter_operational_status(state);

    if (operationalStateId) {
      const dssHasError = hasDockingStationError(robot.dockStationStatus);
      platform.log.debug(`dssHasError: ${dssHasError}, dockStationStatus: ${debugStringify(robot.dockStationStatus ?? {})}`);
      if (!(dssHasError && triggerDssError(robot, platform))) {
        platform.log.debug(`updateFromHomeData-OperationalState: ${RvcOperationalState.OperationalState[operationalStateId]}`);
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
      }
    }
  }
}
