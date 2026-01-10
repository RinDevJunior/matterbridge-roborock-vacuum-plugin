import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { CloudMessageModel } from './model/CloudMessageModel.js';
import { RoborockMatterbridgePlatform } from './module.js';
import { getBatteryStatus, getOperationalErrorState } from './initialData/index.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { CloudMessageResult } from './roborockCommunication/Zmodel/messageResult.js';
import { BatteryMessage, DeviceErrorMessage, DeviceStatusNotify, Home } from './roborockCommunication/index.js';
import { debugStringify } from 'matterbridge/logger';
import { handleLocalMessage } from './runtimes/handleLocalMessage.js';
import { handleCloudMessage } from './runtimes/handleCloudMessage.js';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';

export class PlatformRunner {
  platform: RoborockMatterbridgePlatform;
  constructor(platform: RoborockMatterbridgePlatform) {
    this.platform = platform;
  }

  public async updateRobot(messageSource: NotifyMessageTypes, homeData: unknown): Promise<void> {
    if (messageSource === NotifyMessageTypes.HomeData) {
      updateFromHomeData(homeData as Home, this.platform);
    } else {
      await this.updateFromMQTTMessage(messageSource, homeData);
    }
  }

  public async requestHomeData(): Promise<void> {
    const platform = this.platform;
    if (platform.robots.size === 0 || !platform.rrHomeId) return;
    if (platform.roborockService === undefined) return;

    const homeData = await platform.roborockService.getHomeDataForUpdating(platform.rrHomeId);
    if (homeData === undefined) return;
    await this.updateRobot(NotifyMessageTypes.HomeData, homeData);
  }

  public async updateFromMQTTMessage(messageSource: NotifyMessageTypes, messageData: unknown, duid = '', tracked = false): Promise<void> {
    const platform = this.platform;
    duid = duid || (messageData as DeviceStatusNotify)?.duid || '';

    const robot = platform.robots.get(duid);
    if (robot === undefined) {
      platform.log.error(`Error1: Robot with DUID ${duid} not found`);
      return;
    }

    const deviceData = robot.device.data;
    if (deviceData === undefined) {
      platform.log.error('Device data is undefined');
      return;
    }

    if (!tracked) {
      platform.log.debug(`Receive: ${messageSource} updateFromMQTTMessage: ${debugStringify(messageData as DeviceStatusNotify)}`);
    }

    if (!robot.serialNumber) {
      platform.log.error('Robot serial number is undefined');
      return;
    }

    switch (messageSource) {
      case NotifyMessageTypes.ErrorOccurred: {
        const message = messageData as DeviceErrorMessage;
        const operationalStateId = getOperationalErrorState(message.errorCode);
        if (operationalStateId) {
          platform.log.error(`Error occurred: ${message.errorCode}`);
          robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
        }
        break;
      }
      case NotifyMessageTypes.BatteryUpdate: {
        const message = messageData as BatteryMessage;
        const batteryLevel = message.percentage;
        if (batteryLevel) {
          robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
          robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
        }
        break;
      }

      case NotifyMessageTypes.LocalMessage: {
        const data = messageData as CloudMessageResult;
        const robot = platform.robots.get(duid);
        if (robot && data) {
          await handleLocalMessage(data, platform, duid);
          return;
        }
        platform.log.error(`Error2: Robot with DUID ${duid} not found`);
        break;
      }

      case NotifyMessageTypes.CloudMessage: {
        const data = messageData as CloudMessageModel;
        if (!data) return;
        await handleCloudMessage(data, platform, this, duid);
        break;
      }

      default:
        break;
    }
  }
}
