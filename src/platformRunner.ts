import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { getBatteryState, getBatteryStatus } from './initialData/index.js';
import { NotifyMessageTypes } from './types/notifyMessageTypes.js';
import { debugStringify } from 'matterbridge/logger';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';
import type { MessagePayload } from './types/MessagePayloads.js';
import {
  BatteryMessage,
  CleanInformation,
  DeviceErrorMessage,
  StatusChangeMessage,
} from './roborockCommunication/models/index.js';
import { RoborockMatterbridgePlatform } from './module.js';
import type { RoborockVacuumCleaner } from './types/roborockVacuumCleaner.js';
import { resolveDeviceState } from './share/stateResolver.js';
import { getRunningMode } from './initialData/getSupportedRunModes.js';
import { CleanModeSetting } from './behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { getCleanModeResolver } from './share/runtimeHelper.js';
import { DockErrorCode, OperationStatusCode } from './roborockCommunication/enums/index.js';
import { INVALID_SEGMENT_ID } from './constants/index.js';
import { BurstPollingManager } from './platform/burstPollingManager.js';
import { DockStationStatus } from './model/DockStationStatus.js';
import { triggerDssError } from './runtimes/handleLocalMessage.js';
import { state_to_matter_operational_status, state_to_matter_state } from './share/function.js';
import { VacuumStatus } from './model/VacuumStatus.js';
import { CleanSequenceType } from './behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import {
  getCleanModeName,
  getOperationalErrorName,
  getOperationalStateName,
  getRunModeName,
  getRunModeNameV2,
} from './share/matterStateNames.js';

type RobotHandler<T = unknown> = (robot: RoborockVacuumCleaner, data: T) => void | Promise<void>;

export class PlatformRunner {
  private activateHandlers = false;
  public readonly burstPolling: BurstPollingManager;

  constructor(private readonly platform: RoborockMatterbridgePlatform) {
    this.burstPolling = new BurstPollingManager(platform);
  }

  public activateHandlerFunctions(): void {
    this.activateHandlers = true;
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

    const robots = [...platform.registry.robotsMap.values()];
    const allDevicesHaveRealTimeConnection = robots.every((x) => x.device.specs.hasRealTimeConnection);
    if (allDevicesHaveRealTimeConnection) return;

    const homeData = await platform.roborockService.getHomeDataForUpdating(platform.rrHomeId);
    if (homeData === undefined) return;
    await this.updateRobotWithPayload({ type: NotifyMessageTypes.HomeData, data: homeData });
  }

  /**
   * Update robot state based on message payload.
   * Routes to appropriate handler using type-safe discriminated unions.
   */
  public async updateRobotWithPayload(payload: MessagePayload): Promise<void> {
    if (!this.activateHandlers) return;

    const { type } = payload;
    switch (type) {
      case NotifyMessageTypes.ErrorOccurred:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleErrorOccurred.bind(this));
        break;
      case NotifyMessageTypes.BatteryUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleBatteryUpdate.bind(this));
        break;
      case NotifyMessageTypes.DeviceStatus:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleDeviceStatusUpdate.bind(this));
        break;
      case NotifyMessageTypes.DeviceStatusSimple:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleDeviceStatusSimpleUpdate.bind(this));
        break;
      case NotifyMessageTypes.CleanModeUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleCleanModeUpdate.bind(this));
        break;
      case NotifyMessageTypes.ServiceAreaUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleServiceAreaUpdate.bind(this));
        break;
      case NotifyMessageTypes.HomeData:
        await updateFromHomeData(payload.data, this.platform);
        break;
      default:
        this.platform.log.warn(`No handler registered for message type: ${type}`);
    }
  }

  /**
   * Template method: Execute handler with robot instance.
   * Handles robot lookup, error logging, and passes data to handler.
   */
  private async executeWithRobot<T>(duid: string, data: T, handler: RobotHandler<T>): Promise<void> {
    const robot = this.getRobotOrLogError(duid);
    if (!robot) return;
    await handler(robot, data);
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
   * Processes vacuum and docking station errors, updating Matter attributes accordingly.
   * Prioritizes vacuum errors over docking station errors.
   */
  private async handleErrorOccurred(robot: RoborockVacuumCleaner, message: DeviceErrorMessage): Promise<void> {
    if (!this.platform.configManager.includeVacuumErrorStatus) {
      this.platform.log.debug(
        `Skipping error handling: includeVacuumErrorStatus is disabled, message: ${debugStringify(message)}`,
      );
      return;
    }
    this.platform.log.debug(`Handling error occurred: ${debugStringify(message)}`);
    const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
      RvcOperationalState.Cluster.id,
      'operationalState',
      this.platform.log,
    );

    // Process vacuum errors (highest priority)
    const vacuumStatus = new VacuumStatus(message.vacuumErrorCode ?? 0);
    if (vacuumStatus.hasError()) {
      const errorDetail = vacuumStatus.getErrorState();
      this.platform.log.warn(`Vacuum error detected: ${getOperationalErrorName(errorDetail)}`);
      await robot.updateAttribute(
        RvcOperationalState.Cluster.id,
        'operationalState',
        RvcOperationalState.OperationalState.Error,
        this.platform.log,
      );
      await robot.updateAttribute(
        RvcOperationalState.Cluster.id,
        'operationalError',
        { errorStateId: errorDetail },
        this.platform.log,
      );
      return;
    }

    // If vacuum is running with no errors, clear any previous errors and skip dock processing
    if (currentOperationState === RvcOperationalState.OperationalState.Running) {
      this.platform.log.debug('Vacuum running without errors, clearing error state.');
      await robot.updateAttribute(
        RvcOperationalState.Cluster.id,
        'operationalError',
        { errorStateId: RvcOperationalState.ErrorState.NoError },
        this.platform.log,
      );
      return;
    }

    if (!this.platform.configManager.includeDockStationStatus) {
      return;
    }

    if (message.dockStationStatus !== undefined && message.dockStationStatus !== null) {
      // Process dock station errors (only when vacuum not running)
      const dockStatus = DockStationStatus.parseDockStationStatus(message.dockStationStatus);
      robot.dockStationStatus = dockStatus;

      if (dockStatus.hasError()) {
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalState',
          RvcOperationalState.OperationalState.Error,
          this.platform.log,
        );
        const errorDetail = dockStatus.getMatterOperationalError();
        this.platform.log.warn(`Docking station error detected: ${getOperationalErrorName(errorDetail)}`);
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalError',
          { errorStateId: errorDetail },
          this.platform.log,
        );
      } else {
        this.platform.log.debug('No docking station errors detected.');
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalError',
          { errorStateId: RvcOperationalState.ErrorState.NoError },
          this.platform.log,
        );
      }
      return;
    }

    if (message.dockErrorCode !== DockErrorCode.None) {
      const dockStatus = DockStationStatus.parseDockErrorCode(message.dockErrorCode);
      if (dockStatus !== RvcOperationalState.ErrorState.NoError) {
        this.platform.log.warn(`Docking station error detected: ${getOperationalErrorName(dockStatus)}`);
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalError',
          { errorStateId: dockStatus },
          this.platform.log,
        );
      } else {
        this.platform.log.debug('No docking station errors detected.');
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalError',
          { errorStateId: RvcOperationalState.ErrorState.NoError },
          this.platform.log,
        );
      }

      return;
    }

    // No errors detected and no dock station processing
    this.platform.log.debug('No errors detected, clearing operational error state.');
    await robot.updateAttribute(
      RvcOperationalState.Cluster.id,
      'operationalError',
      { errorStateId: RvcOperationalState.ErrorState.NoError },
      this.platform.log,
    );
  }

  /**
   * Handle battery update messages and update robot power attributes.
   */
  private async handleBatteryUpdate(robot: RoborockVacuumCleaner, message: BatteryMessage): Promise<void> {
    this.platform.log.debug(`Handling battery update: ${debugStringify(message)}`);
    const batteryLevel = message.percentage;
    const deviceStatus = message.deviceStatus;
    const batteryChargeLevel = getBatteryStatus(batteryLevel);

    if (batteryLevel) {
      await robot.updateAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, this.platform.log);
      await robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', batteryChargeLevel, this.platform.log);
    }

    if (batteryLevel && deviceStatus) {
      const batteryChargeState = getBatteryState(deviceStatus, batteryLevel);
      await robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', batteryChargeState, this.platform.log);

      const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
        RvcOperationalState.Cluster.id,
        'operationalState',
        this.platform.log,
      );
      if (
        batteryChargeState === PowerSource.BatChargeState.IsCharging &&
        currentOperationState === RvcOperationalState.OperationalState.Docked
      ) {
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalState',
          RvcOperationalState.OperationalState.Charging,
          this.platform.log,
        );
      }

      if (
        batteryChargeState === PowerSource.BatChargeState.IsAtFullCharge &&
        currentOperationState === RvcOperationalState.OperationalState.Charging
      ) {
        await robot.updateAttribute(
          RvcOperationalState.Cluster.id,
          'operationalState',
          RvcOperationalState.OperationalState.Docked,
          this.platform.log,
        );
      }
    }
  }

  /**
   * Handle device status notify messages and update robot run mode and operational state.
   * Uses state resolution matrix to determine final state based on status code and modifiers.
   */
  private async handleDeviceStatusUpdate(robot: RoborockVacuumCleaner, message: StatusChangeMessage): Promise<void> {
    this.platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

    // Check docking station errors before state resolution
    const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
    const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
    if (dssHasError) {
      await triggerDssError(robot, this.platform);
      return;
    }

    const currentRunMode: number = robot.getAttribute(RvcRunMode.Cluster.id, 'currentMode');

    const currentOperationState: RvcOperationalState.OperationalState = robot.getAttribute(
      RvcOperationalState.Cluster.id,
      'operationalState',
    );

    // Resolve state using state resolution matrix
    const resolvedState = resolveDeviceState(message);

    this.platform.log.notice(
      `[${robot.device.duid}] Resolved state:
      currentRunMode=${getRunModeNameV2(currentRunMode)}, code=${currentRunMode}
      currentOperationState=${getOperationalStateName(currentOperationState)}, code=${currentOperationState}
      newRunMode=${getRunModeName(resolvedState.runMode)}, code=${getRunningMode(resolvedState.runMode)}
      newOperationalState=${getOperationalStateName(resolvedState.operationalState)}, code=${resolvedState.operationalState}`,
    );

    if (
      currentOperationState === RvcOperationalState.OperationalState.Charging &&
      resolvedState.runMode === RvcRunMode.ModeTag.Idle &&
      resolvedState.operationalState === RvcOperationalState.OperationalState.Docked
    ) {
      // Device is still charging; skip Docked update and let handleBatteryUpdate transition away from Charging when battery is full.
      this.platform.log.debug(`Device is still charging, skipping Docked state update`);
      return;
    }

    // Update Matter attributes
    await robot.updateAttribute(
      RvcRunMode.Cluster.id,
      'currentMode',
      getRunningMode(resolvedState.runMode),
      this.platform.log,
    );
    await robot.updateAttribute(
      RvcOperationalState.Cluster.id,
      'operationalState',
      resolvedState.operationalState,
      this.platform.log,
    );

    // Auto-start burst polling when the device enters an active state
    const isActive =
      resolvedState.runMode === RvcRunMode.ModeTag.Cleaning || resolvedState.runMode === RvcRunMode.ModeTag.Mapping;
    if (isActive && !this.burstPolling.has(robot.device.duid)) {
      this.burstPolling.startBurstPolling(robot.device.duid);
    }
  }

  /**
   * Handle simple device status updates from home data API.
   * For devices without real-time connection, uses only status code without modifier flags.
   * Converts to StatusChangeMessage with undefined modifiers for state resolution.
   */
  private async handleDeviceStatusSimpleUpdate(
    robot: RoborockVacuumCleaner,
    message: { duid: string; status: OperationStatusCode },
  ): Promise<void> {
    this.platform.log.debug(`Handling simple device status update: ${debugStringify(message)}`);

    const state = state_to_matter_state(message.status);
    this.platform.log.debug(
      `Resolved state from simple update: ${state !== undefined ? getRunModeName(state) : 'undefined'}`,
    );
    if (state !== undefined) {
      await robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), this.platform.log);
    }

    const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
    const operationalStateId = state_to_matter_operational_status(state);
    const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
    if (dssHasError) {
      await triggerDssError(robot, this.platform);
      return;
    }
    if (operationalStateId !== undefined) {
      this.platform.log.debug(`Updating operational state to: ${getOperationalStateName(operationalStateId)}`);
      await robot.updateAttribute(
        RvcOperationalState.Cluster.id,
        'operationalState',
        operationalStateId,
        this.platform.log,
      );
    }
  }

  /**
   * Handle clean mode update messages and update robot clean mode.
   * Processes clean mode settings (suction power, water flow, mop route).
   */
  private async handleCleanModeUpdate(
    robot: RoborockVacuumCleaner,
    message: {
      suctionPower: number;
      waterFlow: number;
      distance_off: number;
      mopRoute: number | undefined;
      seq_type: number | undefined;
    },
  ): Promise<void> {
    this.platform.log.debug(`Handling clean mode update: ${debugStringify(message)}`);
    const deviceData = robot.device.specs;

    // Update RvcCleanMode based on clean mode settings
    const currentCleanModeSetting = new CleanModeSetting(
      message.suctionPower,
      message.waterFlow,
      message.distance_off,
      message.mopRoute,
      message.seq_type ?? CleanSequenceType.Persist,
    );
    if (currentCleanModeSetting.hasFullSettings) {
      robot.cleanModeSetting = currentCleanModeSetting;
      const forceRunAtDefault = this.platform.configManager.forceRunAtDefault;
      const currentCleanModeResolver = getCleanModeResolver(deviceData.model, forceRunAtDefault);
      const currentCleanMode = currentCleanModeResolver.resolve(currentCleanModeSetting);

      if (currentCleanMode) {
        this.platform.log.notice(`Calculated current clean mode: ${getCleanModeName(currentCleanMode)}`);
        await robot.updateAttribute(RvcCleanMode.Cluster.id, 'currentMode', currentCleanMode, this.platform.log);
      }
    }
  }

  /**
   * Handle service area update messages and update robot service area attributes.
   * Processes service area changes (supported areas, maps, selected areas, current area).
   */
  private async handleServiceAreaUpdate(
    robot: RoborockVacuumCleaner,
    message: { state: OperationStatusCode; cleaningInfo: CleanInformation | undefined },
  ): Promise<void> {
    const logger = this.platform.log;

    if (message.state === OperationStatusCode.Idle) {
      logger.debug('Robot is idle, updating selectedAreas from Roborock service');
      const selectedAreas = this.platform.roborockService?.getSelectedAreas(robot.device.duid) ?? [];
      await robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, this.platform.log);
      return;
    }

    if (
      (message.state === OperationStatusCode.Paused ||
        message.state === OperationStatusCode.Cleaning ||
        message.state === OperationStatusCode.Mapping ||
        message.state === OperationStatusCode.RoomClean ||
        message.state === OperationStatusCode.ZoneClean ||
        message.state === OperationStatusCode.SpotCleaning ||
        message.state === OperationStatusCode.CleanMopCleaning ||
        message.state === OperationStatusCode.CleanMopMopping ||
        message.state === OperationStatusCode.RoomCleanMopCleaning ||
        message.state === OperationStatusCode.RoomCleanMopMopping ||
        message.state === OperationStatusCode.ZoneCleanMopCleaning ||
        message.state === OperationStatusCode.ZoneCleanMopMopping ||
        message.state === OperationStatusCode.RoomMopping ||
        message.state === OperationStatusCode.ZoneMopping) &&
      !message.cleaningInfo
    ) {
      logger.notice('Vacuum is cleaning with no cleaning_info, setting currentArea to null');
      const selectedAreas: number[] =
        robot.getAttribute(ServiceArea.Cluster.id, 'selectedAreas', this.platform.log) ?? [];

      // if vacuum is set to clean only one room, set it when there is no cleaning_info found.
      if (selectedAreas.length === 1) {
        await robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', selectedAreas[0], this.platform.log);
      } else {
        await robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, this.platform.log);
        await robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], this.platform.log);
      }

      return;
    }

    if (!message.cleaningInfo) {
      logger.debug('No cleaning_info available, skipping service area update');
      return;
    }

    const roomIndexMap = this.platform.roborockService?.getSupportedAreasIndexMap(robot.device.duid);
    if (!roomIndexMap || !this.platform.roborockService) {
      logger.error('No room mapping found.');
      return;
    }

    if (this.platform.configManager.isMultipleMapEnabled) {
      const roomData = await this.platform.roborockService.getRoomMap(robot.device.duid, robot.homeInFo.activeMapId);
      robot.homeInFo.activeMapId = robot.homeInFo.mapInfo.getActiveMapId(roomData);
    }

    const source_segment_id = message.cleaningInfo.segment_id ?? INVALID_SEGMENT_ID;
    const source_target_segment_id = message.cleaningInfo.target_segment_id ?? INVALID_SEGMENT_ID;
    const segment_id = source_segment_id !== INVALID_SEGMENT_ID ? source_segment_id : source_target_segment_id; // 4
    const mappedArea = roomIndexMap.getAreaId(segment_id, robot.homeInFo.activeMapId);

    if (!mappedArea) {
      logger.debug(
        `No mapped area found, skipping area mapping.
          source_segment_id: ${source_segment_id},
          source_target_segment_id: ${source_target_segment_id},
          segment_id: ${segment_id},
          currentMappedAreas: ${debugStringify(roomIndexMap)},
          mappedArea: ${mappedArea}`,
      );
      await robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, logger);
      return;
    }

    const supportedAreas = this.platform.roborockService.getSupportedAreas(robot.device.duid);
    const activeArea = supportedAreas.find((x) => x.areaId === mappedArea);
    logger.debug(
      `Mapped area found:
        source_segment_id: ${source_segment_id},
        source_target_segment_id: ${source_target_segment_id},
        segment_id: ${segment_id},
        currentMappedAreas: ${debugStringify(roomIndexMap)},
        activeArea: ${debugStringify(activeArea)}`,
    );

    await robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', mappedArea, logger);
  }
}
