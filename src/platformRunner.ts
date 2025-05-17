import { RvcRunMode, PowerSource, ServiceArea } from 'matterbridge/matter/clusters';
import { getVacuumProperty } from './helper.js';
import { getRunningMode } from './initialData/getSupportedRunModes.js';
import { CloudMessageModel } from './model/CloudMessageModel.js';
import { RoborockMatterbridgePlatform } from './platform.js';
import { state_to_matter_state } from './share/function.js';
import RoomMap from './model/RoomMap.js';
import { getBatteryState, getBatteryStatus } from './initialData/index.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import Device from './roborockCommunication/Zmodel/device.js';
import { CloudMessageResult } from './roborockCommunication/Zmodel/messageResult.js';
import { Protocol } from './roborockCommunication/broadcast/model/protocol.js';
import Home from './roborockCommunication/Zmodel/home.js';
import { DpsPayload } from './roborockCommunication/broadcast/model/dps.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { parseDockingStationStatus } from './model/DockingStationStatus.js';
//TODO: read src/roborock/message-api/codes/StatusCode.ts

export class PlatformRunner {
  platform: RoborockMatterbridgePlatform;
  constructor(platform: RoborockMatterbridgePlatform) {
    this.platform = platform;
  }

  async updateRobot(messageSource: NotifyMessageTypes, homeData: any): Promise<void> {
    if (messageSource === NotifyMessageTypes.HomeData) {
      this.updateHomeData(homeData);
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

  async getRoomMap(device: Device | undefined = undefined): Promise<RoomMap | undefined> {
    const platform = this.platform;
    let rooms = device?.rooms ?? [];

    if (device && platform.roborockService) {
      const roomData = await platform.roborockService.getRoomMappings(device.duid);
      return new RoomMap(roomData ?? [], rooms);
    }

    rooms = platform.robot?.device.rooms ?? [];
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
      platform.log.debug(`${messageSource} updateFromMQTTMessage: ${JSON.stringify(messageData)}`);
    }

    const duid = messageData.duid;
    if (platform.robot === undefined) return;
    if (!platform.robot.serialNumber) {
      platform.log.error('Robot serial number is undefined');
      return;
    }

    const deviceDuid = platform.serialNumberAndDuidMapping.get(platform.robot.serialNumber);
    if (deviceDuid !== duid) {
      platform.log.notice(`DUID mismatch: ${deviceDuid} !== ${duid}, device serial number: ${platform.robot.serialNumber}`);
      return;
    }

    if (messageSource === NotifyMessageTypes.BatteryUpdate) {
      const batteryLevel = messageData.percentage as number;
      if ((messageData.percentage as number) && batteryLevel) {
        platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
        platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
      }
      return;
    }

    if (messageSource === NotifyMessageTypes.LocalMessage) {
      const data = messageData.statusType as CloudMessageResult;
      if (data) {
        const state = state_to_matter_state(data.state);
        if (state) {
          platform.robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(deviceData.model, state), platform.log);
        }

        const currentRoom = data.cleaning_info?.segment_id ?? -1;
        if (currentRoom !== -1) {
          const roomMap = await this.getRoomMap();
          this.platform.log.debug('RoomMap:', JSON.stringify(roomMap));
          this.platform.log.debug('CurrentRoom:', currentRoom);
          platform.robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', currentRoom, platform.log);
        }

        if (data.battery) {
          const batteryLevel = data.battery as number;

          platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
          platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(data.state, data.battery), platform.log);
          platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
        }

        this.processAdditionalProps(platform.robot, data);
      }
    }

    if (messageSource === NotifyMessageTypes.CloudMessage) {
      var data = messageData.data as CloudMessageModel;
      if (!data) {
        data = messageData as CloudMessageModel;
      }
      if (!data) return;

      const messageTypes = Object.keys(data.dps).map(Number);
      const self = this;

      //Known: 122, 121, 102,
      //Unknown: 128, 139
      messageTypes.forEach(async (messageType) => {
        switch (messageType) {
          case Protocol.status_update: {
            const status = data.dps[messageType] as number;
            const matterState = state_to_matter_state(status);
            if (matterState) {
              platform.robot!.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(deviceData.model, matterState), platform.log);
            }
            break;
          }
          case Protocol.rpc_response: {
            const response = data.dps[messageType] as DpsPayload;
            //ignore network info
            if (!self.isStatusUpdate(response.result)) {
              platform.log.notice('Ignore message:', JSON.stringify(data));
              return;
            }

            const roboStatus = response.result[0] as CloudMessageResult;
            if (roboStatus) {
              const message = { duid: messageData.duid, statusType: { ...roboStatus } };
              platform.log.debug('rpc_response:', JSON.stringify(message));
              await self.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, message, true);
            }
            break;
          }
          case Protocol.additional_props:
          case Protocol.todo_some_thing_need_to_correct: {
            break;
          }

          default: {
            platform.log.notice(`Unknown message type: ${messageType} ,`, JSON.stringify(messageData));
            break;
          }
        }
      });
    }
  }

  private async processAdditionalProps(robot: RoborockVacuumCleaner, message: CloudMessageResult): Promise<void> {
    //dss -> DockingStationStatus
    if (message.dss !== undefined) {
      const dss = parseDockingStationStatus(message.dss);
      this.platform.log.debug('DockingStationStatus:', JSON.stringify(dss));
    }

    if (message.fan_power !== undefined) {
      const fanPower = message.fan_power as number;
      //robot.updateAttribute(RvcRunMode.Cluster.id, 'fanPower', fanPower, this.platform.log);
    }
  }

  private isStatusUpdate(result: any): boolean {
    return result && Array.isArray(result) && result.length > 0 && (result[0] as CloudMessageResult).msg_ver !== undefined && (result[0] as CloudMessageResult).msg_ver !== null;
  }

  private updateHomeData(homeData: Home): void {
    const platform = this.platform;
    if (platform.robot === undefined) return;
    const device = homeData.devices.find((d: Device) => d.serialNumber === platform.robot?.serialNumber);
    if (!device) {
      platform.log.error('Device not found in home data');
      return;
    }
    const deviceData = platform.robot?.device.data;
    if (deviceData === undefined) {
      platform.log.error('Device data is undefined');
      return;
    }

    device.schema = homeData.products.find((d) => d.id === device.productId)?.schema ?? [];
    const batteryLevel = getVacuumProperty(device, 'battery');
    platform.robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel ? batteryLevel * 2 : null, platform.log);
    platform.robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);

    const state = getVacuumProperty(device, 'state');
    const matterState = state_to_matter_state(state);
    platform.robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(deviceData.model, matterState), platform.log);
  }
}
