import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { CloudMessageModel } from './model/CloudMessageModel.js';
import { getBatteryStatus, getOperationalErrorState } from './initialData/index.js';
import { NotifyMessageTypes } from './types/notifyMessageTypes.js';
import { debugStringify } from 'matterbridge/logger';
import { handleLocalMessage } from './runtimes/handleLocalMessage.js';
import { handleCloudMessage } from './runtimes/handleCloudMessage.js';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';
import type { MessagePayload } from './types/MessagePayloads.js';
import { BatteryMessage, CloudMessageResult, DeviceErrorMessage, DeviceStatusNotify, Home } from './roborockCommunication/models/index.js';
import { RoborockMatterbridgePlatform } from './module.js';

export class PlatformRunner {
  constructor(private readonly platform: RoborockMatterbridgePlatform) {}

  /**
   * Update robot state based on message payload.
   * Routes to appropriate handler using type-safe discriminated unions.
   */
  public updateRobotWithPayload(payload: MessagePayload): void {
    switch (payload.type) {
      case NotifyMessageTypes.HomeData:
        updateFromHomeData(payload.data, this.platform);
        break;
      case NotifyMessageTypes.LocalMessage:
      case NotifyMessageTypes.CloudMessage:
        this.updateFromMQTTMessage(payload.type, payload.data, payload.duid);
        break;
      case NotifyMessageTypes.BatteryUpdate:
      case NotifyMessageTypes.ErrorOccurred:
        this.updateFromMQTTMessage(payload.type, payload.data, payload.data.duid);
        break;
    }
  }

  /**
   * Update robot state based on message source (legacy method for compatibility).
   * Routes to appropriate handler based on whether message is HomeData or MQTT message.
   */
  public updateRobot(messageSource: NotifyMessageTypes, homeData: unknown): void {
    if (messageSource === NotifyMessageTypes.HomeData) {
      updateFromHomeData(homeData as Home, this.platform);
    } else {
      this.updateFromMQTTMessage(messageSource, homeData);
    }
  }

  /**
   * Request and process home data update from Roborock service.
   * Fetches latest home data including device states and triggers robot state updates.
   * Returns early if no robots configured, no home ID set, or service unavailable.
   */
  public async requestHomeData(): Promise<void> {
    const platform = this.platform;
    if (platform.registry.robotsMap.size === 0 || !platform.rrHomeId) return;
    if (platform.roborockService === undefined) return;

    const homeData = await platform.roborockService.getHomeDataForUpdating(platform.rrHomeId);
    if (homeData === undefined) return;
    this.updateRobotWithPayload({ type: NotifyMessageTypes.HomeData, data: homeData });
  }

  /**
   * Process MQTT messages and update robot state accordingly.
   */
  public updateFromMQTTMessage(messageSource: NotifyMessageTypes, messageData: unknown, duid = '', skipLogging = false): void {
    const platform = this.platform;
    duid = duid || (messageData as DeviceStatusNotify)?.duid || '';

    const robot = platform.registry.getRobot(duid);
    if (robot === undefined) {
      platform.log.error(`Robot with DUID ${duid} not found during MQTT message processing`);
      return;
    }

    const deviceData = robot.device.data;
    if (deviceData === undefined) {
      platform.log.error(`Device data is undefined for robot ${duid}`);
      return;
    }

    if (!skipLogging) {
      platform.log.debug(`Receive: ${messageSource} updateFromMQTTMessage: ${debugStringify(messageData as DeviceStatusNotify)}`);
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
        if (data) {
          handleLocalMessage(data, platform, duid);
        }
        break;
      }

      case NotifyMessageTypes.CloudMessage: {
        const data = messageData as CloudMessageModel;
        if (!data) return;
        handleCloudMessage(data, platform, this, duid);
        break;
      }

      default:
        break;
    }
  }
}
