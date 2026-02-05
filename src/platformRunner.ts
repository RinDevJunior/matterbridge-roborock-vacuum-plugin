import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { getBatteryState, getBatteryStatus, getOperationalErrorState } from './initialData/index.js';
import { NotifyMessageTypes } from './types/notifyMessageTypes.js';
import { debugStringify } from 'matterbridge/logger';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';
import type { MessagePayload } from './types/MessagePayloads.js';
import { BatteryMessage, CleanInformation, DeviceErrorMessage, StatusChangeMessage } from './roborockCommunication/models/index.js';
import { RoborockMatterbridgePlatform } from './module.js';
import type { RoborockVacuumCleaner } from './types/roborockVacuumCleaner.js';
import { state_to_matter_operational_status, state_to_matter_state } from './share/function.js';
import { getRunningMode } from './initialData/getSupportedRunModes.js';
import { CleanModeSetting } from './behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { getCleanModeResolver } from './share/runtimeHelper.js';
import { OperationStatusCode } from './roborockCommunication/enums/index.js';
import { INVALID_SEGMENT_ID } from './constants/index.js';
import { hasDockingStationError } from './model/DockingStationStatus.js';
import { triggerDssError } from './runtimes/handleLocalMessage.js';

type RobotHandler<T = unknown> = (robot: RoborockVacuumCleaner, data: T) => void;
type PayloadHandler = (payload: MessagePayload) => void;

export class PlatformRunner {
  private readonly payloadHandlers: Map<NotifyMessageTypes, PayloadHandler>;

  constructor(private readonly platform: RoborockMatterbridgePlatform) {
    this.payloadHandlers = new Map([
      [
        NotifyMessageTypes.ErrorOccurred,
        (p) => {
          if (p.type === NotifyMessageTypes.ErrorOccurred) {
            this.executeWithRobot(p.data.duid, p.data, this.handleErrorOccurred.bind(this));
          }
        },
      ],
      [
        NotifyMessageTypes.BatteryUpdate,
        (p) => {
          if (p.type === NotifyMessageTypes.BatteryUpdate) {
            this.executeWithRobot(p.data.duid, p.data, this.handleBatteryUpdate.bind(this));
          }
        },
      ],
      [
        NotifyMessageTypes.DeviceStatus,
        (p) => {
          if (p.type === NotifyMessageTypes.DeviceStatus) {
            this.executeWithRobot(p.data.duid, p.data, this.handleDeviceStatusUpdate.bind(this));
          }
        },
      ],
      [
        NotifyMessageTypes.CleanModeUpdate,
        (p) => {
          if (p.type === NotifyMessageTypes.CleanModeUpdate) {
            this.executeWithRobot(p.data.duid, p.data, this.handleCleanModeUpdate.bind(this));
          }
        },
      ],
      [
        NotifyMessageTypes.ServiceAreaUpdate,
        (p) => {
          if (p.type === NotifyMessageTypes.ServiceAreaUpdate) {
            this.executeWithRobot(p.data.duid, p.data, this.handleServiceAreaUpdate.bind(this));
          }
        },
      ],
      [
        NotifyMessageTypes.HomeData,
        (p) => {
          if (p.type === NotifyMessageTypes.HomeData) {
            updateFromHomeData(p.data, this.platform);
          }
        },
      ],
    ]);
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
   * Update robot state based on message payload.
   * Routes to appropriate handler using type-safe discriminated unions.
   */
  public updateRobotWithPayload(payload: MessagePayload): void {
    const handler = this.payloadHandlers.get(payload.type);
    if (handler) {
      handler(payload);
    } else {
      this.platform.log.warn(`No handler registered for message type: ${payload.type}`);
    }
  }

  /**
   * Template method: Execute handler with robot instance.
   * Handles robot lookup, error logging, and passes data to handler.
   */
  private executeWithRobot<T>(duid: string, data: T, handler: RobotHandler<T>): void {
    const robot = this.getRobotOrLogError(duid);
    if (!robot) return;
    handler(robot, data);
  }

  /**
   * Get robot by DUID or log error if not found.
   */
  private getRobotOrLogError(duid: string): RoborockVacuumCleaner | undefined {
    const robot = this.platform.registry.getRobot(duid);
    if (!robot) {
      this.platform.log.error(`Robot with DUID ${duid} not found`);
    }
    return robot;
  }

  /**
   * Handle error occurred messages and update robot operational state.
   */
  private handleErrorOccurred(robot: RoborockVacuumCleaner, message: DeviceErrorMessage): void {
    const operationalStateId = getOperationalErrorState(message.errorCode);
    if (operationalStateId) {
      this.platform.log.error(`Error occurred: ${message.errorCode}`);
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, this.platform.log);
    }
  }

  /**
   * Handle battery update messages and update robot power attributes.
   */
  private handleBatteryUpdate(robot: RoborockVacuumCleaner, message: BatteryMessage): void {
    const batteryLevel = message.percentage;
    const deviceStatus = message.deviceStatus;
    if (batteryLevel) {
      robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, this.platform.log);
      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), this.platform.log);
    }

    if (batteryLevel && deviceStatus) {
      const batteryChargeState = getBatteryState(deviceStatus, batteryLevel);
      const operationalStateId =
        batteryChargeState === PowerSource.BatChargeState.IsCharging ? RvcOperationalState.OperationalState.Charging : RvcOperationalState.OperationalState.Docked;

      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', batteryChargeState, this.platform.log);
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, this.platform.log);
    }
  }

  /**
   * Handle device status notify messages and update robot run mode.
   * Processes CloudMessageResult to extract state.
   */
  private handleDeviceStatusUpdate(robot: RoborockVacuumCleaner, message: StatusChangeMessage): void {
    // Update RvcRunMode based on state
    this.platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

    const state = state_to_matter_state(message.status);
    if (state) {
      robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), this.platform.log);
    }

    const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
    const operationalStateId = state_to_matter_operational_status(state);
    const dssHasError = includeDockStationStatus && hasDockingStationError(robot.dockStationStatus);
    if (dssHasError) {
      triggerDssError(robot, this.platform);
      return;
    }
    if (operationalStateId !== undefined) robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, this.platform.log);
  }

  /**
   * Handle clean mode update messages and update robot clean mode.
   * Processes clean mode settings (suction power, water flow, mop route).
   */
  private handleCleanModeUpdate(robot: RoborockVacuumCleaner, message: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number | undefined }): void {
    const deviceData = robot.device.specs;

    // Update RvcCleanMode based on clean mode settings
    const currentCleanModeSetting = new CleanModeSetting(message.suctionPower, message.waterFlow, message.distance_off, message.mopRoute);
    if (currentCleanModeSetting.hasFullSettings) {
      robot.cleanModeSetting = currentCleanModeSetting;
      const forceRunAtDefault = this.platform.configManager.forceRunAtDefault;
      const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
      const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);

      if (currentCleanMode) {
        robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, this.platform.log);
      }
    }
  }

  /**
   * Handle service area update messages and update robot service area attributes.
   * Processes service area changes (supported areas, maps, selected areas, current area).
   */
  private handleServiceAreaUpdate(robot: RoborockVacuumCleaner, message: { state: OperationStatusCode; cleaningInfo: CleanInformation | undefined }): void {
    const logger = this.platform.log;

    if (message.state === OperationStatusCode.Idle) {
      const selectedAreas = this.platform.roborockService?.getSelectedAreas(robot.device.duid) ?? [];
      robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, this.platform.log);
      return;
    }

    if (message.state === OperationStatusCode.Cleaning && !message.cleaningInfo) {
      logger.debug('No cleaning_info, setting currentArea to null');
      robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, this.platform.log);
      robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], this.platform.log);
      return;
    }

    if (!message.cleaningInfo) {
      logger.debug('No cleaning_info available, skipping service area update');
      return;
    }

    if (this.platform.configManager.isMultipleMapEnabled) {
      // Implement multiple map handling logic here if needed
    } else {
      const service = this.platform.roborockService;
      if (!service) return;

      const currentMappedAreas = service.getSupportedAreas(robot.device.duid);

      const source_segment_id = message.cleaningInfo.segment_id ?? INVALID_SEGMENT_ID;
      const source_target_segment_id = message.cleaningInfo.target_segment_id ?? INVALID_SEGMENT_ID;
      const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
      const mappedArea = currentMappedAreas?.find((x) => x.areaId == segment_id);

      if (!mappedArea) {
        logger.debug(
          `No mapped area found, skipping area mapping.
          source_segment_id: ${source_segment_id}, 
          source_target_segment_id: ${source_target_segment_id}, 
          segment_id: ${segment_id}, 
          mappedArea: ${mappedArea}`,
        );
        return;
      }

      logger.debug(
        `Mapped area found:
        source_segment_id: ${source_segment_id},
        source_target_segment_id: ${source_target_segment_id},
        segment_id: ${segment_id},
        result: ${debugStringify(mappedArea)}`,
      );

      if (segment_id !== INVALID_SEGMENT_ID && mappedArea) {
        robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', segment_id, logger);
      }

      if (segment_id === INVALID_SEGMENT_ID) {
        robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, logger);
      }
    }
  }
}
