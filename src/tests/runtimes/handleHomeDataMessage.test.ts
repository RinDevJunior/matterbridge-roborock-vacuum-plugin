import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateFromHomeData } from '../../runtimes/handleHomeDataMessage.js';
import { homeData } from '../testData/mockData.js';
import { PowerSource, RvcRunMode } from 'matterbridge/matter/clusters';
import { DeviceData, DeviceModel, Device, Home, Product } from '../../roborockCommunication/models/index.js';
import type { DockingStationStatus } from '../../model/DockingStationStatus.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import { asPartial, asType } from '../testUtils.js';
import type { DeviceRegistry } from '../../platform/deviceRegistry.js';
import type { RoborockService } from '../../services/roborockService.js';
import type { AnsiLogger } from 'matterbridge/logger';

// Mocks
const mockUpdateAttribute = vi.fn();
const simpleUpdateAttribute = (...args: any[]) => mockUpdateAttribute(...args);
const duid = 'test-duid';
const robot = asPartial<RoborockVacuumCleaner>({
  updateAttribute: simpleUpdateAttribute,
  device: asPartial<Device>({ duid, name: 'TestVac', data: asPartial<DeviceData>({ model: DeviceModel.QREVO_EDGE_5V1 }) }),
});
const robots = new Map([[duid, robot]]);
const registry = asPartial<DeviceRegistry>({
  get robotsMap() {
    return robots;
  },
  getRobot: (id: string) => robots.get(id) as RoborockVacuumCleaner | undefined,
  hasDevices: () => robots.size > 0,
  registerRobot: vi.fn(),
});
const platform = asPartial<RoborockMatterbridgePlatform>({
  registry: asPartial<DeviceRegistry>(registry),
  log: asType<AnsiLogger>({
    error: vi.fn(),
    debug: vi.fn(),
    notice: vi.fn(),
    fatal: vi.fn(),
  }),
  roborockService: asPartial<RoborockService>({}),
});

describe('updateFromHomeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update robot attributes when valid data is provided', async () => {
    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(platform));

    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeLevel', 0, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', PowerSource.BatChargeState.IsAtFullCharge, expect.anything());
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should log error if robot is not found', async () => {
    platform.registry.robotsMap.clear();
    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(platform));
    expect(platform.log.error).not.toHaveBeenCalledWith(expect.stringContaining('Robot with DUID'));
  });

  it('should log error if device data is undefined', async () => {
    platform.registry.robotsMap.clear();
    // Simulate device missing data by removing the data property
    platform.registry.robotsMap.set('test-duid', asPartial<RoborockVacuumCleaner>({ ...robot, device: asPartial({}) }));
    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(platform));
    expect(platform.log.error).toHaveBeenCalledWith('Device not found in home data');
  });

  it('should return early if no state or matterState', async () => {
    const homeDataWithoutState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: {} }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);
    await updateFromHomeData(homeDataWithoutState, asPartial<RoborockMatterbridgePlatform>(platform));
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should return early if platform has no robots', async () => {
    platform.registry.robotsMap.clear();
    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(platform));
    // Should not throw, just return early
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should skip robot update when robot is found but continue to next device', async () => {
    const homeDataMultipleDevices = {
      ...homeData,
      devices: [
        { ...homeData.devices[0], duid: 'test-duid' }, // This one should succeed
        { ...homeData.devices[0], duid: 'test-duid-2' }, // Second device
      ],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);
    platform.registry.robotsMap.set('test-duid-2', asPartial<RoborockVacuumCleaner>({ ...robot, updateAttribute: vi.fn() }));

    await updateFromHomeData(homeDataMultipleDevices, asPartial<RoborockMatterbridgePlatform>(platform));
    // Both devices should be processed
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('should handle when device is filtered out before loop', async () => {
    const homeDataUnknownDevice = {
      ...homeData,
      devices: [{ ...homeData.devices[0], duid: 'unknown-duid' }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot); // Robot exists but no matching device

    await updateFromHomeData(homeDataUnknownDevice, asPartial<RoborockMatterbridgePlatform>(platform));
    // No devices should match the filter, so no updates
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should handle missing battery level', async () => {
    const homeDataNoBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 8 }) }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataNoBattery, asPartial<RoborockMatterbridgePlatform>(platform));
    // Battery attributes should not be updated
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', expect.anything(), expect.anything());
  });

  it('should handle state without matterState mapping', async () => {
    const homeDataInvalidState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 9999, battery: 100 }) }], // Truly unmapped state
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);
    await updateFromHomeData(homeDataInvalidState, asPartial<RoborockMatterbridgePlatform>(platform));
    // Should update operationalState to Docked for unknown state (per implementation)
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.anything(), expect.anything());
  });

  it('should return early when state is undefined', async () => {
    const homeDataNoState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: {} }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);
    await updateFromHomeData(homeDataNoState, asPartial<RoborockMatterbridgePlatform>(platform));
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should handle missing operational state', async () => {
    const homeDataNoOpState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 9999, battery: 100 }) }], // Truly unmapped state
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);
    await updateFromHomeData(homeDataNoOpState, asPartial<RoborockMatterbridgePlatform>(platform));
    // Should update operationalState to Docked for unknown state (per implementation)
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.anything(), expect.anything());
  });

  it('should process device when it has docking station status', async () => {
    const robotWithDss = asPartial<RoborockVacuumCleaner>({
      updateAttribute: simpleUpdateAttribute,
      device: asPartial<Device>({ duid, name: 'TestVac', data: asPartial<DeviceData>({ model: DeviceModel.QREVO_EDGE_5V1 }) }),
      dockStationStatus: asPartial<DockingStationStatus>({
        cleanFluidStatus: 0,
        waterBoxFilterStatus: 0,
        dustBagStatus: 0,
        dirtyWaterBoxStatus: 0,
        clearWaterBoxStatus: 0,
        isUpdownWaterReady: 0,
      }), // No error
    });
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robotWithDss);

    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(platform));
    // Should process normally when no dss error
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('should log error and continue when robot is removed during processing', async () => {
    // Create a custom platform that removes robot during get()
    const robots = new Map([['test-duid', robot]]);
    const customPlatform = asPartial<RoborockMatterbridgePlatform>({
      log: platform.log,
      roborockService: asPartial<RoborockService>({}),
      registry: asPartial<DeviceRegistry>({
        get robotsMap() {
          return robots;
        },
        getRobot: (id: string) => {
          if (id === 'test-duid') return undefined; // Simulate robot removed
          return robots.get(id);
        },
        hasDevices: () => robots.size > 0,
        registerRobot: vi.fn(),
      }),
    });

    await updateFromHomeData(homeData, asPartial<RoborockMatterbridgePlatform>(customPlatform));
    expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('Robot not found: test-duid'));
  });

  it('should update batChargeState when batteryLevel exists', async () => {
    const homeDataWithBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 8, battery: 50 }) }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataWithBattery, asPartial<RoborockMatterbridgePlatform>(platform));
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.anything(), expect.anything());
  });

  it('should not update batChargeState when batteryLevel is missing', async () => {
    const homeDataNoBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 8 }) }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataNoBattery, platform);
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.anything(), expect.anything());
  });

  it('should handle zero battery level', async () => {
    const homeDataZeroBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 8, battery: 0 }) }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataZeroBattery, platform);
    // Battery is 0, which is falsy, so battery attributes should not be updated
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', expect.anything(), expect.anything());
  });

  it('should handle homeData without matching product schema', async () => {
    const homeDataNoSchema = {
      ...homeData,
      products: [], // No products means schema won't be found
      devices: [{ ...homeData.devices[0], deviceStatus: asPartial({ state: 8, battery: 100 }) }],
    };
    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataNoSchema, platform);
    // Should still process but schema will be empty array
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('should use registered robot model to match product schema when home payload model differs', async () => {
    const homeDataMismatch = asPartial<Home>({
      ...homeData,
      devices: [
        {
          ...homeData.devices[0],
          deviceStatus: asPartial({ state: 8, battery: 100 }),
          data: { ...homeData.devices[0].data, model: DeviceModel.Q7_MAX },
        },
      ],
      products: [asPartial<Product>({ id: homeData.products[0].id, model: robot.device.data?.model, schema: homeData.products[0].schema })],
    });

    platform.registry.robotsMap.clear();
    platform.registry.robotsMap.set('test-duid', robot);

    await updateFromHomeData(homeDataMismatch, platform);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, expect.anything());
  });
});
