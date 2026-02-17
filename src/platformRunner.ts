import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { getBatteryState, getBatteryStatus } from './initialData/index.js';
import { NotifyMessageTypes } from './types/notifyMessageTypes.js';
import { debugStringify } from 'matterbridge/logger';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';
import type { MessagePayload } from './types/MessagePayloads.js';
import { BatteryMessage, CleanInformation, DeviceErrorMessage, StatusChangeMessage } from './roborockCommunication/models/index.js';
import { RoborockMatterbridgePlatform } from './module.js';
import type { RoborockVacuumCleaner } from './types/roborockVacuumCleaner.js';
import { resolveDeviceState } from './share/stateResolver.js';
import { getRunningMode } from './initialData/getSupportedRunModes.js';
import { CleanModeSetting } from './behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { getCleanModeResolver } from './share/runtimeHelper.js';
import { DockErrorCode, OperationStatusCode } from './roborockCommunication/enums/index.js';
import { INVALID_SEGMENT_ID } from './constants/index.js';
import { DockStationStatus } from './model/DockStationStatus.js';
import { triggerDssError } from './runtimes/handleLocalMessage.js';
import { state_to_matter_operational_status, state_to_matter_state } from './share/function.js';
import { VacuumStatus } from './model/VacuumStatus.js';
import { CleanSequenceType } from './behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { smartCleanModeConfigs } from './behaviors/roborock.vacuum/core/cleanModeConfig.js';

type RobotHandler<T = unknown> = (robot: RoborockVacuumCleaner, data: T) => void;
type PayloadHandler = (payload: MessagePayload) => void;

export class PlatformRunner {
  private activateHandlers = false;
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
        NotifyMessageTypes.DeviceStatusSimple,
        (p) => {
          if (p.type === NotifyMessageTypes.DeviceStatusSimple) {
            this.executeWithRobot(p.data.duid, p.data, this.handleDeviceStatusSimpleUpdate.bind(this));
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
    this.updateRobotWithPayload({ type: NotifyMessageTypes.HomeData, data: homeData });
  }

  /**
   * Update robot state based on message payload.
   * Routes to appropriate handler using type-safe discriminated unions.
   */
  public updateRobotWithPayload(payload: MessagePayload): void {
    if (!this.activateHandlers) return;

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
   * Get human-readable name for run mode enum value.
   */
  private getRunModeName(runMode: number): string {
    return Object.keys(RvcRunMode.ModeTag).find((key) => RvcRunMode.ModeTag[key as keyof typeof RvcRunMode.ModeTag] === runMode) || String(runMode);
  }

  /**
   * Get human-readable name for operational state enum value.
   */
  private getOperationalStateName(operationalState: number): string {
    return (
      Object.keys(RvcOperationalState.OperationalState).find(
        (key) => RvcOperationalState.OperationalState[key as keyof typeof RvcOperationalState.OperationalState] === operationalState,
      ) || String(operationalState)
    );
  }

  private getCleanModeName(mode: number): string {
    return smartCleanModeConfigs.find((x) => x.mode === mode)?.label ?? 'Not found';
  }

  private getOperationalErrorName(operationalError: number): string {
    return (
      Object.keys(RvcOperationalState.ErrorState).find((key) => RvcOperationalState.ErrorState[key as keyof typeof RvcOperationalState.ErrorState] === operationalError) ||
      String(operationalError)
    );
  }

  /**
   * Handle error occurred messages and update robot operational state.
   * Processes vacuum and docking station errors, updating Matter attributes accordingly.
   * Prioritizes vacuum errors over docking station errors.
   */
  private handleErrorOccurred(robot: RoborockVacuumCleaner, message: DeviceErrorMessage): void {
    if (!this.platform.configManager.includeVacuumErrorStatus) {
      this.platform.log.debug('Skipping error handling: includeVacuumErrorStatus is disabled');
      return;
    }
    this.platform.log.debug(`Handling error occurred: ${debugStringify(message)}`);
    const currentOperationState = robot.getAttribute(RvcOperationalState.Cluster.id, 'operationalState');

    // Process vacuum errors (highest priority)
    const vacuumStatus = new VacuumStatus(message.vacuumErrorCode ?? 0);
    if (vacuumStatus.hasError()) {
      const errorDetail = vacuumStatus.getErrorState();
      this.platform.log.warn(`Vacuum error detected: ${this.getOperationalErrorName(errorDetail)}`);
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, this.platform.log);
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: errorDetail }, this.platform.log);
      return;
    }

    // If vacuum is running with no errors, clear any previous errors and skip dock processing
    if (currentOperationState === RvcOperationalState.OperationalState.Running) {
      this.platform.log.debug('Vacuum running without errors, clearing error state.');
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.platform.log);
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
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, this.platform.log);
        const errorDetail = dockStatus.getMatterOperationalError();
        this.platform.log.warn(`Docking station error detected: ${this.getOperationalErrorName(errorDetail)}`);
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: errorDetail }, this.platform.log);
      } else {
        this.platform.log.debug('No docking station errors detected.');
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.platform.log);
      }
      return;
    }

    if (message.dockErrorCode !== DockErrorCode.None) {
      const dockStatus = DockStationStatus.parseDockErrorCode(message.dockErrorCode);
      if (dockStatus !== RvcOperationalState.ErrorState.NoError) {
        this.platform.log.warn(`Docking station error detected: ${this.getOperationalErrorName(dockStatus)}`);
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: dockStatus }, this.platform.log);
      } else {
        this.platform.log.debug('No docking station errors detected.');
        robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.platform.log);
      }

      return;
    }

    // No errors detected and no dock station processing
    this.platform.log.debug('No errors detected, clearing operational error state.');
    robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.platform.log);
  }

  /**
   * Handle battery update messages and update robot power attributes.
   */
  private handleBatteryUpdate(robot: RoborockVacuumCleaner, message: BatteryMessage): void {
    this.platform.log.debug(`Handling battery update: ${debugStringify(message)}`);
    const batteryLevel = message.percentage;
    const deviceStatus = message.deviceStatus;
    if (batteryLevel) {
      robot.setAttribute(PowerSource.Cluster.id, 'batPercentRemaining', batteryLevel * 2, this.platform.log);
      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeLevel', getBatteryStatus(batteryLevel), this.platform.log);
    }

    if (batteryLevel && deviceStatus) {
      const batteryChargeState = getBatteryState(deviceStatus, batteryLevel);
      robot.updateAttribute(PowerSource.Cluster.id, 'batChargeState', batteryChargeState, this.platform.log);
    }
  }

  /**
   * Handle device status notify messages and update robot run mode and operational state.
   * Uses state resolution matrix to determine final state based on status code and modifiers.
   */
  private handleDeviceStatusUpdate(robot: RoborockVacuumCleaner, message: StatusChangeMessage): void {
    this.platform.log.debug(`Handling device status update: ${debugStringify(message)}`);

    // Check docking station errors before state resolution
    const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
    const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
    if (dssHasError) {
      triggerDssError(robot, this.platform);
      return;
    }

    // Resolve state using state resolution matrix
    const resolvedState = resolveDeviceState(message);
    this.platform.log.notice(
      `Resolved state: runMode=${this.getRunModeName(resolvedState.runMode)}, operationalState=${this.getOperationalStateName(resolvedState.operationalState)}`,
    );

    // Update Matter attributes
    robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(resolvedState.runMode), this.platform.log);
    robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', resolvedState.operationalState, this.platform.log);
  }

  /**
   * Handle simple device status updates from home data API.
   * For devices without real-time connection, uses only status code without modifier flags.
   * Converts to StatusChangeMessage with undefined modifiers for state resolution.
   */
  private handleDeviceStatusSimpleUpdate(robot: RoborockVacuumCleaner, message: { duid: string; status: OperationStatusCode }): void {
    this.platform.log.debug(`Handling simple device status update: ${debugStringify(message)}`);

    const state = state_to_matter_state(message.status);
    this.platform.log.debug(`Resolved state from simple update: ${state !== undefined ? this.getRunModeName(state) : 'undefined'}`);
    if (state !== undefined) {
      robot.updateAttribute(RvcRunMode.Cluster.id, 'currentMode', getRunningMode(state), this.platform.log);
    }

    const includeDockStationStatus = this.platform.configManager.includeDockStationStatus;
    const operationalStateId = state_to_matter_operational_status(state);
    const dssHasError = includeDockStationStatus && (robot.dockStationStatus?.hasError() ?? false);
    if (dssHasError) {
      triggerDssError(robot, this.platform);
      return;
    }
    if (operationalStateId !== undefined) {
      this.platform.log.debug(`Updating operational state to: ${this.getOperationalStateName(operationalStateId)}`);
      robot.updateAttribute(RvcOperationalState.Cluster.id, 'operationalState', operationalStateId, this.platform.log);
    }
  }

  /**
   * Handle clean mode update messages and update robot clean mode.
   * Processes clean mode settings (suction power, water flow, mop route).
   */
  private handleCleanModeUpdate(
    robot: RoborockVacuumCleaner,
    message: { suctionPower: number; waterFlow: number; distance_off: number; mopRoute: number | undefined; seq_type: number | undefined },
  ): void {
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
        this.platform.log.notice(`Calculated current clean mode: ${this.getCleanModeName(currentCleanMode)}`);
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
      logger.debug('Robot is idle, updating selectedAreas from Roborock service');
      const selectedAreas = this.platform.roborockService?.getSelectedAreas(robot.device.duid) ?? [];
      robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, this.platform.log);
      return;
    }

    if (message.state === OperationStatusCode.Cleaning && !message.cleaningInfo) {
      logger.notice('No cleaning_info, setting currentArea to null');
      robot.updateAttribute(ServiceArea.Cluster.id, 'currentArea', null, this.platform.log);
      robot.updateAttribute(ServiceArea.Cluster.id, 'selectedAreas', [], this.platform.log);
      return;
    }

    if (!message.cleaningInfo) {
      logger.debug('No cleaning_info available, skipping service area update');
      return;
    }

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
          currentMappedAreas: ${debugStringify(currentMappedAreas)},
          mappedArea: ${mappedArea}`,
      );
      return;
    }

    logger.debug(
      `Mapped area found:
        source_segment_id: ${source_segment_id},
        source_target_segment_id: ${source_target_segment_id},
        segment_id: ${segment_id},
        currentMappedAreas: ${debugStringify(currentMappedAreas)},
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
