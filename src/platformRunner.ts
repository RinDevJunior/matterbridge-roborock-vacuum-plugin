import { RvcRunMode, PowerSource, ServiceArea, RvcOperationalState, RvcCleanMode } from 'matterbridge/matter/clusters';
import { getVacuumProperty } from './helper.js';
import { getRunningMode } from './initialData/getSupportedRunModes.js';
import { CloudMessageModel } from './model/CloudMessageModel.js';
import { RoborockMatterbridgePlatform } from './platform.js';
import { state_to_matter_operational_status, state_to_matter_state } from './share/function.js';
import RoomMap from './model/RoomMap.js';
import { getBatteryState, getBatteryStatus, getOperationalErrorState } from './initialData/index.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { CloudMessageResult } from './roborockCommunication/Zmodel/messageResult.js';
import { Protocol } from './roborockCommunication/broadcast/model/protocol.js';
import { DpsPayload } from './roborockCommunication/broadcast/model/dps.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { hasDockingStationError, parseDockingStationStatus } from './model/DockingStationStatus.js';
import { Device, Home } from './roborockCommunication/index.js';
import { OperationStatusCode } from './roborockCommunication/Zenum/operationStatusCode.js';
import { getCurrentCleanModeFromFanPowerFunc, getCurrentCleanModeFromWaterBoxModeFunc, getCurrentCleanModeFunc } from './share/runtimeHelper.js';
import { debugStringify } from 'matterbridge/logger';

export class PlatformRunner {
  platform: RoborockMatterbridgePlatform;
  constructor(platform: RoborockMatterbridgePlatform) {
    this.platform = platform;
  }

  async updateRobot(messageSource: NotifyMessageTypes, homeData: any): Promise<void> {
    if (messageSource === NotifyMessageTypes.HomeData) {
      this.updateFromHomeData(homeData);
    } else {
      await this.updateFromMQTTMessage(messageSource, homeData);
    }
  }

  async requestHomeData(): Promise<void> {
    const platform = this.platform;
    if (!platform.robot || !platform.robot.rrHomeId) return;
    if (platform.roborockService === undefined) return;

    const homeData = await platform.roborockService.getHomeDataForUpdating(platform.robot.rrHomeId);
    await platform.platformRunner?.updateRobot(NotifyMessageTypes.HomeData, homeData);
  }

  public async getRoomMapFromDevice(device: Device): Promise<RoomMap> {
    const platform = this.platform;
    const rooms = device?.rooms ?? [];

    if (device && platform.roborockService) {
      const roomData = await platform.roborockService.getRoomMappings(device.duid);
      return new RoomMap(roomData ?? [], rooms);
    }
    return new RoomMap([], rooms);
  }

  async getRoomMap(): Promise<RoomMap | undefined> {
    const platform = this.platform;
    const rooms = platform.robot?.device.rooms ?? [];
    if (platform.robot?.device === undefined || platform.roborockService === undefined) return undefined;
    if (platform.robot.roomInfo === undefined) {
      const roomData = await platform.roborockService.getRoomMappings(platform.robot.device.duid);
      platform.robot.roomInfo = new RoomMap(roomData ?? [], rooms);
      return platform.robot.roomInfo;
    }
    return platform.robot.roomInfo;
  }

  private async updateFromMQTTMessage(messageSource: NotifyMessageTypes, messageData: any, tracked = false): Promise<void> {
    const platform = this.platform;
    const deviceData = platform.robot?.device.data;
    if (deviceData === undefined) {
      platform.log.error('Device data is undefined');
      return;
    }

    if (!tracked) {
      platform.log.debug(`${messageSource} updateFromMQTTMessage: ${debugStringify(messageData)}`);
    }

    const duid = messageData.duid;
    if (platform.robot === undefined) return;
    if (!platform.robot.serialNumber) {
      platform.log.error('Robot serial number is undefined');
      return;
    }

    //duid is set as device serial number
    if (platform.robot.serialNumber !== duid) {
      platform.log.notice(`DUID mismatch: ${duid}, device serial number: ${platform.robot.serialNumber}`);
      return;
    }

    switch (messageSource) {
      case NotifyMessageTypes.ErrorOccurred: {
        const errorCode = messageData.errorCode as number;
        const operationalStateId = getOperationalErrorState(errorCode);
        if (operationalStateId) {
          platform.log.error(`Error occurred: ${errorCode}`);
          platform.robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
        }
        break;
      }
      case NotifyMessageTypes.BatteryUpdate: {
        const batteryLevel = messageData.percentage as number;
        if ((messageData.percentage as number) && batteryLevel) {
          platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
          platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
        }
        break;
      }

      case NotifyMessageTypes.LocalMessage: {
        const data = messageData.statusType as CloudMessageResult;
        if (data) {
          const state = state_to_matter_state(data.state);
          if (state) {
            platform.robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(deviceData.model, state), platform.log);
          }

          const currentRoom = data.cleaning_info?.segment_id ?? -1;
          const currentMappedAreas = this.platform.roborockService?.getSupportedAreas(duid);
          const isMappedArea = currentMappedAreas?.some((x) => x.areaId == currentRoom);

          if (currentRoom !== -1 && isMappedArea) {
            const roomMap = await this.getRoomMap();
            this.platform.log.debug(`RoomMap: ${roomMap ? debugStringify(roomMap) : 'undefined'}`);
            this.platform.log.debug('CurrentRoom:', currentRoom);
            platform.robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', currentRoom, platform.log);
          }

          if (data.battery) {
            const batteryLevel = data.battery as number;
            platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
            platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(data.state, data.battery), platform.log);
            platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
          }

          const currentCleanMode = getCurrentCleanModeFunc(deviceData.model)(data.fan_power, data.water_box_mode);
          if (currentCleanMode) {
            platform.robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
          }

          this.processAdditionalProps(platform.robot, data);
        }
        break;
      }

      case NotifyMessageTypes.CloudMessage: {
        var data = messageData.data as CloudMessageModel;
        if (!data) {
          data = messageData as CloudMessageModel;
        }
        if (!data) return;
        this.handlerCloudMessage(data, duid, deviceData.model);
        break;
      }

      default:
        break;
    }
  }

  private handlerCloudMessage(data: CloudMessageModel, duid: string, model: string): void {
    const platform = this.platform;
    const messageTypes = Object.keys(data.dps).map(Number);
    const self = this;

    //Known: 122, 121, 102,
    //Unknown: 128, 139
    messageTypes.forEach(async (messageType) => {
      switch (messageType) {
        case Protocol.status_update: {
          const status = Number(data.dps[messageType]);
          const matterState = state_to_matter_state(status);
          if (matterState) {
            platform.robot!.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(model, matterState), platform.log);
          }

          const operationalStateId = state_to_matter_operational_status(status);
          if (operationalStateId) {
            platform.robot!.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
          }
          break;
        }
        case Protocol.rpc_response: {
          const response = data.dps[messageType] as DpsPayload;
          //ignore network info
          if (!self.isStatusUpdate(response.result)) {
            platform.log.debug('Ignore message:', debugStringify(data));
            return;
          }

          const roboStatus = response.result[0] as CloudMessageResult;
          if (roboStatus) {
            const message = { duid: duid, statusType: { ...roboStatus } };
            platform.log.debug('rpc_response:', debugStringify(message));
            await self.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, message, true);
          }
          break;
        }
        case Protocol.suction_power: {
          const fanPower = data.dps[messageType] as number;
          const currentCleanMode = getCurrentCleanModeFromFanPowerFunc(model)(fanPower);
          if (currentCleanMode) {
            platform.robot!.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
          }
          break;
        }

        case Protocol.water_box_mode: {
          const water_box_mode = data.dps[messageType] as number;
          const currentCleanMode = getCurrentCleanModeFromWaterBoxModeFunc(model)(water_box_mode);
          if (currentCleanMode) {
            platform.robot!.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
          }
          break;
        }
        case Protocol.additional_props:
        case Protocol.back_type: {
          //TODO: check if this is needed
          break;
        }
        default: {
          platform.log.notice(`Unknown message type: ${Protocol[messageType] ?? messageType} ,`, debugStringify(data));
          break;
        }
      }
    });
  }

  private async processAdditionalProps(robot: RoborockVacuumCleaner, message: CloudMessageResult): Promise<void> {
    //dss -> DockingStationStatus
    const platform = this.platform;
    if (platform.config.enableExperimentalFeature && message.dss !== undefined) {
      const dss = parseDockingStationStatus(message.dss);
      this.platform.log.debug('DockingStationStatus:', debugStringify(dss));

      const currentOperationState = robot.getAttribute(RvcOperationalState.Cluster.id, 'operationalState') as RvcOperationalState.OperationalState;

      //Only update docking station status if it is not running
      if (dss && hasDockingStationError(dss) && currentOperationState !== RvcOperationalState.OperationalState.Running) {
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, platform.log);
      }
    }

    if (message.fan_power !== undefined) {
      const fanPower = message.fan_power as number;
      //robot.updateAttribute(RvcRunMode.Cluster.id, 'fanPower', fanPower, this.platform.log);
    }
  }

  private isStatusUpdate(result: any): boolean {
    return result && Array.isArray(result) && result.length > 0 && (result[0] as CloudMessageResult).msg_ver !== undefined && (result[0] as CloudMessageResult).msg_ver !== null;
  }

  private updateFromHomeData(homeData: Home): void {
    const platform = this.platform;
    if (platform.robot === undefined) return;
    const device = homeData.devices.find((d: Device) => d.duid === platform.robot?.serialNumber);
    const deviceData = platform.robot?.device.data;
    if (!device || deviceData === undefined) {
      platform.log.error('Device not found in home data');
      return;
    }

    device.schema = homeData.products.find((prd) => prd.id == device.productId || prd.model == device.data.model)?.schema ?? [];
    this.platform.log.debug('updateFromHomeData-homeData:', debugStringify(homeData));
    this.platform.log.debug('updateFromHomeData-device:', debugStringify(device));

    const batteryLevel = getVacuumProperty(device, 'battery');
    if (batteryLevel) {
      platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel ? batteryLevel * 2 : 200, platform.log);
      platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
    }

    const state = getVacuumProperty(device, 'state');
    const matterState = state_to_matter_state(state);
    if (!state || !matterState) {
      return;
    }
    this.platform.log.debug(`updateFromHomeData-RvcRunMode code: ${state} name: ${OperationStatusCode[state]}, matterState: ${RvcRunMode.ModeTag[matterState]}`);

    if (matterState) {
      platform.robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(deviceData.model, matterState), platform.log);
    }

    const operationalStateId = state_to_matter_operational_status(state);
    if (operationalStateId) {
      this.platform.log.debug(`updateFromHomeData-OperationalState: ${RvcOperationalState.OperationalState[operationalStateId]}`);
      platform.robot!.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
    }

    if (batteryLevel) {
      platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(state, batteryLevel), platform.log);
    }
  }
}
