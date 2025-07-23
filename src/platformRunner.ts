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
import { BatteryMessage, Device, DeviceErrorMessage, DeviceStatusNotify, Home } from './roborockCommunication/index.js';
import { OperationStatusCode } from './roborockCommunication/Zenum/operationStatusCode.js';
import { getCurrentCleanModeFunc } from './share/runtimeHelper.js';
import { debugStringify } from 'matterbridge/logger';
// import { getErrorFromErrorCode } from './initialData/getOperationalStates.js';

export class PlatformRunner {
  platform: RoborockMatterbridgePlatform;
  constructor(platform: RoborockMatterbridgePlatform) {
    this.platform = platform;
  }

  public async updateRobot(messageSource: NotifyMessageTypes, homeData: unknown): Promise<void> {
    if (messageSource === NotifyMessageTypes.HomeData) {
      this.updateFromHomeData(homeData as Home);
    } else {
      await this.updateFromMQTTMessage(messageSource, homeData);
    }
  }

  public async requestHomeData(): Promise<void> {
    const platform = this.platform;
    if (platform.robots.size === 0 || !platform.rrHomeId) return;
    if (platform.roborockService === undefined) return;

    const homeData = await platform.roborockService.getHomeDataForUpdating(platform.rrHomeId);
    await this.updateRobot(NotifyMessageTypes.HomeData, homeData);
  }

  public async getRoomMapFromDevice(device: Device): Promise<RoomMap> {
    const platform = this.platform;
    const rooms = device?.rooms ?? [];
    platform.log.error(`getRoomMapFromDevice: ${debugStringify(rooms)}`);
    if (device && platform.roborockService) {
      const roomData = await platform.roborockService.getRoomMappings(device.duid);
      if (roomData !== undefined && roomData.length > 0) {
        platform.log.error(`getRoomMapFromDevice - roomData: ${debugStringify(roomData ?? [])}`);
        return new RoomMap(roomData ?? [], rooms);
      }

      const mapInfo = await platform.roborockService.getMapInformation(device.duid);
      if (mapInfo && mapInfo.maps && mapInfo.maps.length > 0) {
        platform.log.error(`getRoomMapFromDevice - mapInfo: ${debugStringify(mapInfo.maps)}`);

        const roomDataMap = mapInfo.maps[0].rooms.map((r) => [r.id, parseInt(r.name)] as [number, number]);
        return new RoomMap(roomDataMap, rooms);
      }
    }

    return new RoomMap([], rooms);
  }

  async getRoomMap(duid: string): Promise<RoomMap | undefined> {
    const platform = this.platform;

    const robot = platform.robots.get(duid);
    if (robot === undefined) {
      platform.log.error(`Error6: Robot with DUID ${duid} not found`);
      return undefined;
    }

    if (platform.roborockService === undefined) return undefined;

    const rooms = robot.device.rooms ?? [];
    // if (platform.robot?.device === undefined || platform.roborockService === undefined) return undefined;
    if (robot.roomInfo === undefined) {
      const roomData = await platform.roborockService.getRoomMappings(robot.device.duid);
      if (roomData !== undefined && roomData.length > 0) {
        robot.roomInfo = new RoomMap(roomData ?? [], rooms);
        return robot.roomInfo;
      }
    }

    if (robot.roomInfo === undefined) {
      const mapInfo = await platform.roborockService.getMapInformation(robot.device.duid);
      if (mapInfo && mapInfo.maps && mapInfo.maps.length > 0) {
        platform.log.error(`getRoomMap - mapInfo: ${debugStringify(mapInfo.maps)}`);

        const roomDataMap = mapInfo.maps[0].rooms.map((r) => [r.id, parseInt(r.name)] as [number, number]);
        robot.roomInfo = new RoomMap(roomDataMap, rooms);
      }
    }

    return robot.roomInfo;
  }

  private async updateFromMQTTMessage(messageSource: NotifyMessageTypes, messageData: unknown, duid = '', tracked = false): Promise<void> {
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

    // duid is set as device serial number
    // if (platform.robot.serialNumber !== duid) {
    //   platform.log.notice(`DUID mismatch: ${duid}, device serial number: ${platform.robot.serialNumber}`);
    //   return;
    // }

    switch (messageSource) {
      case NotifyMessageTypes.ErrorOccurred: {
        const message = messageData as DeviceErrorMessage;
        const operationalStateId = getOperationalErrorState(message.errorCode);
        if (operationalStateId) {
          platform.log.error(`Error occurred: ${message.errorCode}`);
          robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);

          // const errorState = getErrorFromErrorCode(message.errorCode);
          // if (operationalStateId === RvcOperationalState.OperationalState.Error && errorState) {
          //   platform.robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', errorState, platform.log);
          // }
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
        if (!robot) {
          platform.log.error(`Error2: Robot with DUID ${duid} not found`);
          return;
        }

        if (data) {
          const state = state_to_matter_state(data.state);
          if (state) {
            robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), platform.log);
          }

          const currentMappedAreas = this.platform.roborockService?.getSupportedAreas(duid);
          const roomMap = await this.getRoomMap(duid);
          const targetRoom = data.cleaning_info?.target_segment_id ?? -1;
          const isTargetMappedArea = currentMappedAreas?.some((x) => x.areaId == targetRoom);

          if (targetRoom !== -1 && isTargetMappedArea) {
            this.platform.log.debug(`RoomMap: ${roomMap ? debugStringify(roomMap) : 'undefined'}`);
            this.platform.log.debug(`TargetRoom: ${targetRoom}, room name: ${roomMap?.rooms.find((x) => x.id === targetRoom)?.displayName ?? 'unknown'}`);
            robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', targetRoom, platform.log);
          }

          const currentRoom = data.cleaning_info?.segment_id ?? -1;
          const isMappedArea = currentMappedAreas?.some((x) => x.areaId == currentRoom);
          if (currentRoom !== -1 && isMappedArea) {
            this.platform.log.debug(`RoomMap: ${roomMap ? debugStringify(roomMap) : 'undefined'}`);
            this.platform.log.debug(`CurrentRoom: ${currentRoom}, room name: ${roomMap?.rooms.find((x) => x.id === currentRoom)?.displayName ?? 'unknown'}`);
            robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', currentRoom, platform.log);
          }

          if (data.battery) {
            const batteryLevel = data.battery as number;
            robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, platform.log);
            robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(data.state, data.battery), platform.log);
            robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
          }

          const currentCleanModeSetting = {
            suctionPower: data.cleaning_info?.fan_power ?? data.fan_power,
            waterFlow: data.cleaning_info?.water_box_status ?? data.water_box_mode,
            distance_off: data.distance_off,
            mopRoute: data.cleaning_info?.mop_mode ?? data.mop_mode,
          };

          this.platform.log.debug(`data: ${debugStringify(data)}`);
          this.platform.log.debug(`currentCleanModeSetting: ${debugStringify(currentCleanModeSetting)}`);

          if (currentCleanModeSetting.mopRoute && currentCleanModeSetting.suctionPower && currentCleanModeSetting.waterFlow) {
            const currentCleanMode = getCurrentCleanModeFunc(
              deviceData.model,
              this.platform.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false,
            )(currentCleanModeSetting);
            this.platform.log.debug(`Current clean mode: ${currentCleanMode}`);

            if (currentCleanMode) {
              robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, platform.log);
            }
          }

          this.processAdditionalProps(robot, data, duid);
        }
        break;
      }

      case NotifyMessageTypes.CloudMessage: {
        const data = messageData as CloudMessageModel;
        if (!data) return;
        this.handlerCloudMessage(data, duid);
        break;
      }

      default:
        break;
    }
  }

  private handlerCloudMessage(data: CloudMessageModel, duid: string): void {
    const platform = this.platform;
    const messageTypes = Object.keys(data.dps).map(Number);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const robot = platform.robots.get(duid);
    if (robot === undefined) {
      platform.log.error(`Error3: Robot with DUID ${duid} not found`);
      return;
    }

    // Known: 122, 121, 102,
    // Unknown: 128, 139
    messageTypes.forEach(async (messageType) => {
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
            if (!(dssHasError && self.triggerDssError(robot))) {
              robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
            }
          }
          break;
        }
        case Protocol.rpc_response: {
          const response = data.dps[messageType] as DpsPayload;
          // ignore network info
          if (!self.isStatusUpdate(response.result)) {
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
            await self.updateFromMQTTMessage(NotifyMessageTypes.LocalMessage, message, duid, true);
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
        case Protocol.additional_props:
        case Protocol.back_type: {
          // TODO: check if this is needed
          break;
        }
        default: {
          platform.log.notice(`Unknown message type: ${Protocol[messageType] ?? messageType} ,`, debugStringify(data));
          break;
        }
      }
    });
  }

  private async processAdditionalProps(robot: RoborockVacuumCleaner, message: CloudMessageResult, duid: string): Promise<void> {
    // dss -> DockingStationStatus
    const dssStatus = this.getDssStatus(message, duid);
    if (dssStatus) {
      this.triggerDssError(robot);
    }
  }

  private getDssStatus(message: CloudMessageResult, duid: string): RvcOperationalState.OperationalState | undefined {
    const platform = this.platform;
    const robot = platform.robots.get(duid);
    if (robot === undefined) {
      platform.log.error(`Error4: Robot with DUID ${duid} not found`);
      return undefined;
    }

    if (
      platform.enableExperimentalFeature &&
      platform.enableExperimentalFeature.enableExperimentalFeature &&
      platform.enableExperimentalFeature.advancedFeature.includeDockStationStatus &&
      message.dss !== undefined
    ) {
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

  private isStatusUpdate(result: unknown): boolean {
    return (
      Array.isArray(result) &&
      result.length > 0 &&
      typeof result[0] === 'object' &&
      result[0] !== null &&
      'msg_ver' in result[0] &&
      (result[0] as CloudMessageResult).msg_ver !== undefined &&
      (result[0] as CloudMessageResult).msg_ver !== null
    );
  }

  private updateFromHomeData(homeData: Home): void {
    const platform = this.platform;

    if (platform.robots.size === 0) return;
    const devices = homeData.devices.filter((d: Device) => platform.robots.has(d.duid));

    for (const device of devices) {
      const robot = platform.robots.get(device.duid);
      if (robot === undefined) {
        platform.log.error(`Error5: Robot with DUID ${device.duid} not found`);
        continue;
      }

      const deviceData = robot.device.data;
      if (!device || deviceData === undefined) {
        platform.log.error('Device not found in home data');
        return;
      }

      device.schema = homeData.products.find((prd) => prd.id === device.productId || prd.model === device.data.model)?.schema ?? [];
      this.platform.log.debug('updateFromHomeData-homeData:', debugStringify(homeData));
      this.platform.log.debug('updateFromHomeData-device:', debugStringify(device));

      const batteryLevel = getVacuumProperty(device, 'battery');

      this.platform.log.debug('updateFromHomeData-schema:' + debugStringify(device.schema));
      this.platform.log.debug('updateFromHomeData-battery:' + debugStringify(device.deviceStatus));

      if (batteryLevel) {
        robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel ? batteryLevel * 2 : 200, platform.log);
        robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), platform.log);
      }

      const state = getVacuumProperty(device, 'state');
      const matterState = state_to_matter_state(state);
      if (!state || !matterState) {
        return;
      }
      this.platform.log.debug(`updateFromHomeData-RvcRunMode code: ${state} name: ${OperationStatusCode[state]}, matterState: ${RvcRunMode.ModeTag[matterState]}`);

      if (matterState) {
        robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(matterState), platform.log);
      }

      const operationalStateId = state_to_matter_operational_status(state);

      if (operationalStateId) {
        const dssHasError = hasDockingStationError(robot.dockStationStatus);
        this.platform.log.debug(`dssHasError: ${dssHasError}, dockStationStatus: ${debugStringify(robot.dockStationStatus ?? {})}`);
        if (!(dssHasError && this.triggerDssError(robot))) {
          this.platform.log.debug(`updateFromHomeData-OperationalState: ${RvcOperationalState.OperationalState[operationalStateId]}`);
          robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, platform.log);
        }
      }

      if (batteryLevel) {
        robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', getBatteryState(state, batteryLevel), platform.log);
      }
    }
  }

  private triggerDssError(robot: RoborockVacuumCleaner): boolean {
    const platform = this.platform;
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
}
