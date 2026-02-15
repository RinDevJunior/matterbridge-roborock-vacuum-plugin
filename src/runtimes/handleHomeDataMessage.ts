import { getVacuumProperty } from '../share/helper.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { debugStringify } from 'matterbridge/logger';
import { Device, Home } from '../roborockCommunication/models/index.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { DockErrorCode } from '../roborockCommunication/enums/vacuumAndDockErrorCode.js';
import { CleanSequenceType } from '../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

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

    const deviceData = robot.device.specs;
    if (!device || deviceData === undefined) {
      platform.log.error('Device not found in home data');
      return;
    }

    device.schema = homeData.products.find((prd) => prd.id === device.productId || prd.model === robot.device.specs.model || prd.model === device.specs.model)?.schema ?? [];
    platform.log.debug('updateFromHomeData-homeData:', debugStringify(homeData));
    platform.log.debug('updateFromHomeData-device:', debugStringify(device));
    platform.log.debug('updateFromHomeData-schema:' + debugStringify(device.schema));
    platform.log.debug('updateFromHomeData-deviceStatus:' + debugStringify(device.deviceStatus));

    const batteryLevel = getVacuumProperty(device, 'battery');
    const state = getVacuumProperty(device, 'state');
    const errorCode = getVacuumProperty(device, 'error_code');
    const suctionPower = getVacuumProperty(device, 'fan_power');
    const waterBoxMode = getVacuumProperty(device, 'water_box_mode');
    const chargeStatus = getVacuumProperty(device, 'charge_status');

    if (errorCode && errorCode !== 0) {
      platform.platformRunner.updateRobotWithPayload({
        type: NotifyMessageTypes.ErrorOccurred,
        data: {
          duid: device.duid,
          vacuumErrorCode: errorCode,
          dockErrorCode: DockErrorCode.None,
          dockStationStatus: undefined,
        },
      });
    }

    if (batteryLevel) {
      platform.platformRunner.updateRobotWithPayload({
        type: NotifyMessageTypes.BatteryUpdate,
        data: {
          duid: device.duid,
          percentage: batteryLevel,
          chargeStatus: chargeStatus,
          deviceStatus: state,
        },
      });
    }

    if (state && !deviceData.hasRealTimeConnection) {
      platform.log.notice(`hasRealTimeConnection is false, updating device status from home data: ${state}`);
      platform.platformRunner.updateRobotWithPayload({
        type: NotifyMessageTypes.DeviceStatusSimple,
        data: {
          duid: device.duid,
          status: state,
        },
      });
    }

    if (suctionPower && waterBoxMode) {
      platform.platformRunner.updateRobotWithPayload({
        type: NotifyMessageTypes.CleanModeUpdate,
        data: {
          duid: device.duid,
          suctionPower: suctionPower,
          waterFlow: waterBoxMode,
          distance_off: 0,
          mopRoute: undefined,
          seq_type: CleanSequenceType.Persist,
        },
      });
    }
  }
}
