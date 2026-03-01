import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformRunner } from '../platformRunner.js';
import { NotifyMessageTypes } from '../types/notifyMessageTypes.js';
import { RoborockMatterbridgePlatform } from '../module.js';
import { RoborockVacuumCleaner } from '../types/roborockVacuumCleaner.js';
import { Device, DeviceSpecs, DeviceModel } from '../roborockCommunication/models/index.js';
import {
  asPartial,
  createMockLogger,
  createMockDeviceRegistry,
  createMockRoborockService,
  createMockConfigManager,
} from './testUtils.js';
import { RvcOperationalState, RvcRunMode } from 'matterbridge/matter/clusters';
import { OperationStatusCode } from '../roborockCommunication/enums/index.js';
import type { DockStationStatus } from '../model/DockStationStatus.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import type { MessagePayload } from '../types/MessagePayloads.js';
import { CleanSequenceType } from '../behaviors/roborock.vacuum/enums/CleanSequenceType.js';
import { HomeEntity } from '../core/domain/entities/Home.js';
import { MapInfo } from '../core/application/models/index.js';

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

describe('PlatformRunner.updateRobotWithPayload - resolved state logging', () => {
  let platform: RoborockMatterbridgePlatform;
  let runner: PlatformRunner;
  let robot: RoborockVacuumCleaner;
  const mockLogger = createMockLogger();

  beforeEach(() => {
    const mapInfo = asPartial<MapInfo>({
      getActiveMapId: vi.fn().mockReturnValue(1),
    });
    robot = asPartial<RoborockVacuumCleaner>({
      serialNumber: 'test-duid',
      device: asPartial<Device>({
        duid: 'test-duid',
        specs: asPartial<DeviceSpecs>({ model: DeviceModel.S7 }),
      }),
      updateAttribute: vi.fn(),
      getAttribute: vi.fn().mockImplementation((clusterId: number, attribute: string) => {
        if (clusterId === RvcRunMode.Cluster.id && attribute === 'currentMode') return 1;
        if (clusterId === RvcOperationalState.Cluster.id && attribute === 'operationalState')
          return RvcOperationalState.OperationalState.Paused;
      }),
      setAttribute: vi.fn(),
      cleanModeSetting: new CleanModeSetting(1, 1, 1, 1, CleanSequenceType.Persist),
      dockStationStatus: asPartial<DockStationStatus>({}),
      homeInFo: asPartial<HomeEntity>({ activeMapId: 0, mapInfo }),
    });
    platform = asPartial<RoborockMatterbridgePlatform>({
      registry: createMockDeviceRegistry({}, new Map([['test-duid', robot]])),
      log: mockLogger,
      roborockService: createMockRoborockService(),
      configManager: createMockConfigManager({ includeVacuumErrorStatus: true }),
    });
    runner = new PlatformRunner(platform);
    runner.activateHandlerFunctions();
    vi.clearAllMocks();
  });

  it('should log resolved state for Paused status (status=10) with inCleaning=true', () => {
    const statusMessage = {
      duid: 'test-duid',
      status: OperationStatusCode.Paused,
      inCleaning: true,
      inReturning: false,
      inFreshState: false,
      isLocating: false,
      isExploring: false,
      inWarmup: undefined,
    };
    const payload: MessagePayload = { type: NotifyMessageTypes.DeviceStatus, data: statusMessage };

    runner.updateRobotWithPayload(payload);

    expect(mockLogger.notice).toHaveBeenCalledOnce();
    const logOutput = vi.mocked(mockLogger.notice).mock.calls[0][0] as string;
    // console.log('log.notice output:\n', logOutput);
    expect(logOutput).toContain('[test-duid] Resolved state:');

    expect(robot.updateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 2, mockLogger);
    expect(robot.updateAttribute).toHaveBeenCalledWith(
      RvcOperationalState.Cluster.id,
      'operationalState',
      RvcOperationalState.OperationalState.Paused,
      mockLogger,
    );
  });
});
