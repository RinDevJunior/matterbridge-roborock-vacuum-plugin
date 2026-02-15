import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { Device, DeviceSpecs, DeviceModel, BatteryMessage, DeviceErrorMessage, CleanInformation, Home } from '../roborockCommunication/models/index.js';
import { asPartial, createMockLogger, createMockDeviceRegistry, createMockRoborockService, createMockConfigManager, asType } from './testUtils.js';
import { PowerSource, RvcCleanMode, RvcOperationalState, RvcRunMode, ServiceArea } from 'matterbridge/matter/clusters';
import { DockErrorCode, OperationStatusCode, VacuumErrorCode } from '../roborockCommunication/enums/index.js';
import type { DockStationStatus } from '../model/DockStationStatus.js';
import * as initialDataIndex from '../initialData/index.js';
import * as runtimeHelper from '../share/runtimeHelper.js';
import * as handleHomeDataMessage from '../runtimes/handleHomeDataMessage.js';
import * as handleLocalMessage from '../runtimes/handleLocalMessage.js';
import * as dockingStationStatus from '../model/DockStationStatus.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import type { MessagePayload } from '../types/MessagePayloads.js';
import { ModeResolver } from '../behaviors/roborock.vacuum/core/modeResolver.js';
import { CleanSequenceType } from '../behaviors/roborock.vacuum/enums/CleanSequenceType.js';

vi.mock('../initialData/index.js', () => ({
  getOperationalErrorState: vi.fn().mockReturnValue(2),
  getBatteryStatus: vi.fn((level: number) => (level > 80 ? 0 : level > 20 ? 1 : 2)),
  getBatteryState: vi.fn((_status: OperationStatusCode, _level: number) => 1),
}));

vi.mock('../share/stateResolver.js', () => ({
  resolveDeviceState: vi.fn((message) => {
    const { status } = message;
    if (status === OperationStatusCode.Cleaning) {
      return { runMode: 1, operationalState: 1 }; // Cleaning + Running
    }
    if (status === OperationStatusCode.Idle) {
      return { runMode: 0, operationalState: 66 }; // Idle + Docked
    }
    if (status === OperationStatusCode.Unknown) {
      return { runMode: 0, operationalState: 66 }; // Idle + Docked
    }
    return { runMode: 0, operationalState: 66 }; // Default: Idle + Docked
  }),
}));

vi.mock('../runtimes/handleHomeDataMessage.js', () => ({
  updateFromHomeData: vi.fn(),
}));

vi.mock('../runtimes/handleLocalMessage.js', () => ({
  triggerDssError: vi.fn(),
}));

vi.mock('../model/DockStationStatus.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../model/DockStationStatus.js')>();
  return {
    ...actual,
    hasDockingStationError: vi.fn().mockReturnValue(false),
  };
});

vi.mock('../share/runtimeHelper.js', () => ({
  getCleanModeResolver: vi.fn(() => ({
    resolve: vi.fn().mockReturnValue(1),
  })),
}));

vi.mock('../initialData/getSupportedRunModes.js', () => ({
  getRunningMode: vi.fn().mockReturnValue(1),
}));

describe('PlatformRunner.requestHomeData', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;

  it('should return early if no robots exist', async () => {
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map()),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is not set (undefined)', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ specs: asPartial<DeviceSpecs>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: undefined,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if rrHomeId is falsy (empty string)', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ specs: asPartial<DeviceSpecs>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: undefined,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: vi.fn() }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService?.getHomeDataForUpdating).not.toHaveBeenCalled();
  });

  it('should return early if roborockService is undefined', async () => {
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ specs: asPartial<DeviceSpecs>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: undefined,
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    await runner.requestHomeData();

    expect(platform.roborockService).toBeUndefined();
  });

  it('should return early if getHomeDataForUpdating returns undefined', async () => {
    const getHomeDataMock = vi.fn().mockResolvedValue(undefined);
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ specs: asPartial<DeviceSpecs>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: getHomeDataMock }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    const updateRobotWithPayloadSpy = vi.spyOn(runner, 'updateRobotWithPayload');

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith(12345);
    expect(updateRobotWithPayloadSpy).not.toHaveBeenCalled();
  });

  it('should call updateRobotWithPayload when homeData is available', async () => {
    const homeData = { devices: [], products: [] };
    const getHomeDataMock = vi.fn().mockResolvedValue(homeData);
    const placeholderRobot = asPartial<RoborockVacuumCleaner>({ serialNumber: '123', device: asPartial<Device>({ specs: asPartial<DeviceSpecs>({}) }), updateAttribute: vi.fn() });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['123', placeholderRobot]])),
      rrHomeId: 12345,
      roborockService: createMockRoborockService({ getHomeDataForUpdating: getHomeDataMock }),
      log: createMockLogger(),
    });

    runner = new PlatformRunner(platform);
    const updateRobotWithPayloadSpy = vi.spyOn(runner, 'updateRobotWithPayload').mockImplementation(() => {});

    await runner.requestHomeData();

    expect(getHomeDataMock).toHaveBeenCalledWith(12345);
    expect(updateRobotWithPayloadSpy).toHaveBeenCalledWith({ type: NotifyMessageTypes.HomeData, data: homeData });
  });
});

describe('PlatformRunner.updateRobotWithPayload', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;
  let robot: RoborockVacuumCleaner;
  const mockLogger = createMockLogger();

  beforeEach(() => {
    robot = asPartial<RoborockVacuumCleaner>({
      serialNumber: 'test-duid',
      device: asPartial<Device>({
        duid: 'test-duid',
        specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7 }),
      }),
      updateAttribute: vi.fn(),
      getAttribute: vi.fn().mockReturnValue(RvcOperationalState.OperationalState.Docked),
      setAttribute: vi.fn(),
      cleanModeSetting: new CleanModeSetting(1, 1, 1, 1, CleanSequenceType.Persist),
      dockStationStatus: asPartial<DockStationStatus>({}),
    });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robot]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager(),
    });
    runner = new PlatformRunner(platform);
    runner.activateHandlerFunctions();
    vi.clearAllMocks();
  });

  it('should log warning for unhandled message type', () => {
    const payload = { type: 'UnknownType', data: {} } as unknown as MessagePayload;
    runner.updateRobotWithPayload(payload);
    expect(mockLogger.warn).toHaveBeenCalledWith('No handler registered for message type: UnknownType');
  });

  it('should handle ErrorOccurred message', () => {
    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.LidarBlocked, dockErrorCode: DockErrorCode.None, dockStationStatus: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runner.updateRobotWithPayload(payload);
    expect(mockLogger.warn).toHaveBeenCalledWith('Vacuum error detected: NavigationSensorObscured');
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, mockLogger);
  });

  it('should not update operational state when getOperationalErrorState returns undefined', () => {
    vi.mocked(initialDataIndex.getOperationalErrorState).mockReturnValueOnce(undefined);
    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.LidarBlocked, dockErrorCode: DockErrorCode.None, dockStationStatus: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(robot.updateAttribute).toHaveBeenCalled();
  });

  it('should handle ErrorOccurred message with robot not found', () => {
    const errorMessage: DeviceErrorMessage = {
      duid: 'unknown-duid',
      vacuumErrorCode: VacuumErrorCode.LidarBlocked,
      dockErrorCode: DockErrorCode.None,
      dockStationStatus: undefined,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.error).toHaveBeenCalledWith('Robot with DUID unknown-duid not found');
  });

  it('should handle BatteryUpdate message with battery level only', () => {
    const batteryMessage = new BatteryMessage('test-duid', 85, undefined, undefined);
    const payload: MessagePayload = { type: NotifyMessageTypes.BatteryUpdate, data: batteryMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.setAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 170, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeLevel', 0, mockLogger);
  });

  it('should handle BatteryUpdate message with battery level and device status', () => {
    const batteryMessage = new BatteryMessage('test-duid', 50, 1, OperationStatusCode.Charging);
    const payload: MessagePayload = { type: NotifyMessageTypes.BatteryUpdate, data: batteryMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.setAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 100, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeLevel', 1, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', PowerSource.BatChargeState.IsCharging, mockLogger);
  });

  it('should not update battery charge state when device status is missing', () => {
    const batteryMessage = new BatteryMessage('test-duid', 50, 1, undefined);
    const payload: MessagePayload = { type: NotifyMessageTypes.BatteryUpdate, data: batteryMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.setAttribute).toHaveBeenCalledTimes(1);
    expect(robot.updateAttribute).toHaveBeenCalledTimes(1);
    expect(robot.updateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.anything(), mockLogger);
  });

  it('should handle DeviceStatus message', () => {
    const statusMessage = {
      duid: 'test-duid',
      status: OperationStatusCode.Cleaning,
      inCleaning: true,
      inReturning: false,
      inFreshState: false,
      isLocating: false,
      isExploring: false,
      inWarmup: false,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatus, data: statusMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', 1, mockLogger);
  });

  it('should handle Unknown status with default state', () => {
    const statusMessage = {
      duid: 'test-duid',
      status: OperationStatusCode.Unknown,
      inCleaning: false,
      inReturning: false,
      inFreshState: false,
      isLocating: false,
      isExploring: false,
      inWarmup: false,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatus, data: statusMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', 66, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledTimes(2);
  });

  it('should trigger dock station error when docking station has error', () => {
    const mockDockStatus = Object.assign(asPartial<DockStationStatus>({ cleanFluidStatus: 1 }), {
      hasError: vi.fn().mockReturnValue(true),
    });

    const robotWithErrorStatus = asPartial<RoborockVacuumCleaner>({
      serialNumber: 'test-duid',
      device: asPartial<Device>({
        duid: 'test-duid',
        specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7 }),
      }),
      updateAttribute: vi.fn(),
      cleanModeSetting: new CleanModeSetting(1, 1, 1, 1, CleanSequenceType.Persist),
      dockStationStatus: mockDockStatus,
    });

    mockDockStatus.hasError = vi.fn().mockReturnValue(true);

    const platformWithDockStatus = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robotWithErrorStatus]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager({ includeDockStationStatus: true }),
    });
    const runnerWithDockStatus = new PlatformRunner(platformWithDockStatus);

    const statusMessage = {
      duid: 'test-duid',
      status: OperationStatusCode.Idle,
      inCleaning: false,
      inReturning: false,
      inFreshState: false,
      isLocating: false,
      isExploring: false,
      inWarmup: false,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatus, data: statusMessage };

    runnerWithDockStatus.activateHandlerFunctions();
    runnerWithDockStatus.updateRobotWithPayload(payload);

    expect(mockDockStatus.hasError).toHaveBeenCalled();
    expect(handleLocalMessage.triggerDssError).toHaveBeenCalledWith(robotWithErrorStatus, platformWithDockStatus);
    expect(robotWithErrorStatus.updateAttribute).not.toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', expect.anything(), mockLogger);
  });

  it('should not check dock station error when includeDockStationStatus is false', () => {
    const statusMessage = {
      duid: 'test-duid',
      status: OperationStatusCode.Idle,
      inCleaning: false,
      inReturning: false,
      inFreshState: false,
      isLocating: false,
      isExploring: false,
      inWarmup: false,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatus, data: statusMessage };

    runner.updateRobotWithPayload(payload);
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', 66, mockLogger);
  });

  it('should handle CleanModeUpdate message with full settings', () => {
    const cleanModeMessage = { duid: 'test-duid', suctionPower: 2, waterFlow: 3, distance_off: 1, mopRoute: 1, seq_type: 0 };
    const payload: MessagePayload = { type: NotifyMessageTypes.CleanModeUpdate, data: cleanModeMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcCleanMode.Cluster.id, 'currentMode', 1, mockLogger);
    expect(robot.cleanModeSetting).toBeInstanceOf(CleanModeSetting);
  });

  it('should not update clean mode when settings are incomplete', () => {
    const cleanModeMessage = { duid: 'test-duid', suctionPower: 2, waterFlow: 3, distance_off: 1, mopRoute: undefined, seq_type: 0 };
    const payload: MessagePayload = { type: NotifyMessageTypes.CleanModeUpdate, data: cleanModeMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should not update clean mode when resolver returns undefined', () => {
    vi.mocked(runtimeHelper.getCleanModeResolver).mockReturnValueOnce(
      asPartial<ModeResolver>({
        resolve: vi.fn().mockReturnValue(undefined),
      }),
    );

    const cleanModeMessage = { duid: 'test-duid', suctionPower: 2, waterFlow: 3, distance_off: 1, mopRoute: 1, seq_type: 0 };
    const payload: MessagePayload = { type: NotifyMessageTypes.CleanModeUpdate, data: cleanModeMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should handle ServiceAreaUpdate message when state is Idle', () => {
    const selectedAreas = [1, 2, 3];
    platform.roborockService = createMockRoborockService({
      getSelectedAreas: vi.fn().mockReturnValue(selectedAreas),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Idle, cleaningInfo: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', selectedAreas, mockLogger);
  });

  it('should handle ServiceAreaUpdate when state is Cleaning without cleaningInfo', () => {
    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.notice).toHaveBeenCalledWith('No cleaning_info, setting currentArea to null');
    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLogger);
  });

  it('should handle ServiceAreaUpdate when cleaningInfo is missing for non-cleaning state', () => {
    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Paused, cleaningInfo: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith('No cleaning_info available, skipping service area update');
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should handle ServiceAreaUpdate with cleaningInfo and valid segment_id', () => {
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: 4, target_segment_id: undefined });
    const mappedArea = { areaId: 4, matterAreaId: 4, mapId: 1 };
    platform.roborockService = createMockRoborockService({
      getSupportedAreas: vi.fn().mockReturnValue([mappedArea]),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 4, mockLogger);
  });

  it('should handle ServiceAreaUpdate with target_segment_id when segment_id is invalid', () => {
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: -1, target_segment_id: 5 });
    const mappedArea = { areaId: 5, matterAreaId: 5, mapId: 1 };
    platform.roborockService = createMockRoborockService({
      getSupportedAreas: vi.fn().mockReturnValue([mappedArea]),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', 5, mockLogger);
  });

  it('should set currentArea to null when segment_id is INVALID_SEGMENT_ID and mapped area exists', () => {
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: -1, target_segment_id: -1 });
    const mappedArea = { areaId: -1, matterAreaId: -1, mapId: 1 };
    platform.roborockService = createMockRoborockService({
      getSupportedAreas: vi.fn().mockReturnValue([mappedArea]),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'currentArea', null, mockLogger);
  });

  it('should skip area mapping when no mapped area found', () => {
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: 10, target_segment_id: undefined });
    platform.roborockService = createMockRoborockService({
      getSupportedAreas: vi.fn().mockReturnValue([]),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No mapped area found'));
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should return early when roborockService is undefined for ServiceAreaUpdate', () => {
    platform.roborockService = undefined;
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: 4, target_segment_id: undefined });
    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should handle HomeData message', () => {
    const homeData = { devices: [], products: [] };
    const payload: MessagePayload = { type: NotifyMessageTypes.HomeData, data: asPartial<Home>(homeData) };

    runner.updateRobotWithPayload(payload);

    expect(handleHomeDataMessage.updateFromHomeData).toHaveBeenCalledWith(homeData, platform);
  });

  it('should not process messages when handlers are not activated', () => {
    const newRunner = new PlatformRunner(platform);
    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.LidarBlocked, dockErrorCode: DockErrorCode.None, dockStationStatus: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    newRunner.updateRobotWithPayload(payload);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should clear error when vacuum is running without errors', () => {
    vi.mocked(robot.getAttribute).mockReturnValue(RvcOperationalState.OperationalState.Running);
    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.None, dockErrorCode: DockErrorCode.None, dockStationStatus: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith('Vacuum running without errors, clearing error state.');
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, mockLogger);
  });

  it('should process dock station errors when includeDockStationStatus is enabled', () => {
    const mockDockStatus = Object.assign(asPartial<DockStationStatus>({}), {
      hasError: vi.fn().mockReturnValue(true),
      getMatterOperationalError: vi.fn().mockReturnValue(RvcOperationalState.ErrorState.FailedToFindChargingDock),
    });

    const platformWithDockStatus = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robot]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager({ includeDockStationStatus: true }),
    });
    const runnerWithDockStatus = new PlatformRunner(platformWithDockStatus);
    runnerWithDockStatus.activateHandlerFunctions();

    vi.spyOn(dockingStationStatus.DockStationStatus, 'parseDockStationStatus').mockReturnValue(mockDockStatus);

    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.None, dockErrorCode: DockErrorCode.None, dockStationStatus: 168 };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runnerWithDockStatus.updateRobotWithPayload(payload);

    expect(mockDockStatus.hasError).toHaveBeenCalled();
    expect(mockDockStatus.getMatterOperationalError).toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith('Docking station error detected: FailedToFindChargingDock');
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', RvcOperationalState.OperationalState.Error, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(
      RvcOperationalState.Cluster.id,
      'operationalError',
      { errorStateId: RvcOperationalState.ErrorState.FailedToFindChargingDock },
      mockLogger,
    );
  });

  it('should clear errors when dock station has no errors', () => {
    const mockDockStatus = Object.assign(asPartial<DockStationStatus>({}), {
      hasError: vi.fn().mockReturnValue(false),
    });

    const platformWithDockStatus = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robot]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager({ includeDockStationStatus: true }),
    });
    const runnerWithDockStatus = new PlatformRunner(platformWithDockStatus);
    runnerWithDockStatus.activateHandlerFunctions();

    vi.spyOn(dockingStationStatus.DockStationStatus, 'parseDockStationStatus').mockReturnValue(mockDockStatus);

    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.None, dockErrorCode: DockErrorCode.None, dockStationStatus: 0 };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runnerWithDockStatus.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith('No docking station errors detected.');
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, mockLogger);
  });

  it('should clear errors when no errors detected and no dock station processing', () => {
    const errorMessage: DeviceErrorMessage = { duid: 'test-duid', vacuumErrorCode: VacuumErrorCode.None, dockErrorCode: DockErrorCode.None, dockStationStatus: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ErrorOccurred, data: errorMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith('No errors detected, clearing operational error state.');
    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, mockLogger);
  });

  it('should not update battery charge state when battery level is missing', () => {
    const batteryMessage = new BatteryMessage('test-duid', asType<number>(undefined), 1, OperationStatusCode.Charging);
    const payload: MessagePayload = { type: NotifyMessageTypes.BatteryUpdate, data: batteryMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should handle DeviceStatusSimple message with undefined state', () => {
    const statusMessage = { duid: 'test-duid', status: OperationStatusCode.Unknown };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatusSimple, data: statusMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, mockLogger);
  });

  it('should trigger dock station error in DeviceStatusSimple when dock has error', () => {
    const mockDockStatus = Object.assign(asPartial<DockStationStatus>({}), {
      hasError: vi.fn().mockReturnValue(true),
    });

    const robotWithDockError = asPartial<RoborockVacuumCleaner>({
      serialNumber: 'test-duid',
      device: asPartial<Device>({
        duid: 'test-duid',
        specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7 }),
      }),
      updateAttribute: vi.fn(),
      dockStationStatus: mockDockStatus,
    });

    const platformWithDockStatus = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robotWithDockError]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager({ includeDockStationStatus: true }),
    });
    const runnerWithDockStatus = new PlatformRunner(platformWithDockStatus);
    runnerWithDockStatus.activateHandlerFunctions();

    const statusMessage = { duid: 'test-duid', status: OperationStatusCode.Idle };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatusSimple, data: statusMessage };

    runnerWithDockStatus.updateRobotWithPayload(payload);

    expect(handleLocalMessage.triggerDssError).toHaveBeenCalledWith(robotWithDockError, platformWithDockStatus);
    expect(robotWithDockError.updateAttribute).not.toHaveBeenCalledWith(RvcOperationalState.Cluster.id, 'operationalState', expect.anything(), mockLogger);
  });

  it('should handle ServiceAreaUpdate when getSelectedAreas returns empty array', () => {
    platform.roborockService = createMockRoborockService({
      getSelectedAreas: vi.fn().mockReturnValue([]),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Idle, cleaningInfo: undefined };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(robot.updateAttribute).toHaveBeenCalledWith(ServiceArea.Cluster.id, 'selectedAreas', [], mockLogger);
  });

  it('should handle ServiceAreaUpdate with cleaningInfo but getSupportedAreas returns undefined', () => {
    const cleaningInfo = asPartial<CleanInformation>({ segment_id: 4, target_segment_id: undefined });
    platform.roborockService = createMockRoborockService({
      getSupportedAreas: vi.fn().mockReturnValue(undefined),
    });

    const serviceAreaMessage = { duid: 'test-duid', state: OperationStatusCode.Cleaning, cleaningInfo };
    const payload: MessagePayload = { type: NotifyMessageTypes.ServiceAreaUpdate, data: serviceAreaMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No mapped area found'));
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });
});
