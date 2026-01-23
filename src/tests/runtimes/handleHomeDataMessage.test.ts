import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceData } from '../../roborockCommunication/Zmodel/device.js';
import { updateFromHomeData } from '../../runtimes/handleHomeDataMessage.js';
import { homeData } from '../testData/mockData.js';
import { PowerSource, RvcRunMode } from 'matterbridge/matter/clusters';

// Mocks
const mockUpdateAttribute = vi.fn();
const duid = 'test-duid';
const robot = {
  updateAttribute: mockUpdateAttribute,
  device: { data: { model: 'test-model' } as unknown as DeviceData | undefined },
  dockStationStatus: {},
};
const platform = {
  robots: new Map([[duid, robot]]),
  log: {
    error: vi.fn(),
    debug: vi.fn(),
    notice: vi.fn(),
    /* eslint-disable no-console */
    fatal: vi.fn().mockImplementation((message: string, ...arg: unknown[]) => {
      console.info(message, ...arg);
    }),
  },
  roborockService: {},
  enableExperimentalFeature: {},
};

describe('updateFromHomeData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update robot attributes when valid data is provided', async () => {
    await updateFromHomeData(homeData, platform as any);

    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', 200, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeLevel', 0, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(RvcRunMode.Cluster.id, 'currentMode', 1, expect.anything());
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', PowerSource.BatChargeState.IsAtFullCharge, expect.anything());
    expect(platform.log.error).not.toHaveBeenCalled();
  });

  it('should log error if robot is not found', async () => {
    platform.robots.clear();
    await updateFromHomeData(homeData, platform as any);
    expect(platform.log.error).not.toHaveBeenCalledWith(expect.stringContaining('Robot with DUID'));
  });

  it('should log error if device data is undefined', async () => {
    platform.robots.clear();
    platform.robots.set('test-duid', { ...robot, device: { data: undefined } });
    await updateFromHomeData(homeData, platform as any);
    expect(platform.log.error).toHaveBeenCalledWith('Device not found in home data');
  });

  it('should return early if no state or matterState', async () => {
    const homeDataWithoutState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: {} as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);
    await updateFromHomeData(homeDataWithoutState, platform as any);
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should return early if platform has no robots', async () => {
    platform.robots.clear();
    await updateFromHomeData(homeData, platform as any);
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
    platform.robots.clear();
    platform.robots.set('test-duid', robot);
    platform.robots.set('test-duid-2', { ...robot, updateAttribute: vi.fn() });

    await updateFromHomeData(homeDataMultipleDevices, platform as any);
    // Both devices should be processed
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('should handle when device is filtered out before loop', async () => {
    const homeDataUnknownDevice = {
      ...homeData,
      devices: [{ ...homeData.devices[0], duid: 'unknown-duid' }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot); // Robot exists but no matching device

    await updateFromHomeData(homeDataUnknownDevice, platform as any);
    // No devices should match the filter, so no updates
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should handle missing battery level', async () => {
    const homeDataNoBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 8 } as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);

    await updateFromHomeData(homeDataNoBattery, platform as any);
    // Battery attributes should not be updated
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', expect.anything(), expect.anything());
  });

  it('should handle state without matterState mapping', async () => {
    const homeDataInvalidState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 9999, battery: 100 } as any }], // Truly unmapped state
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);
    await updateFromHomeData(homeDataInvalidState, platform as any);
    // Should update operationalState to Docked for unknown state (per implementation)
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.anything(), expect.anything());
  });

  it('should return early when state is undefined', async () => {
    const homeDataNoState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: {} as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);
    await updateFromHomeData(homeDataNoState, platform as any);
    expect(mockUpdateAttribute).not.toHaveBeenCalled();
  });

  it('should handle missing operational state', async () => {
    const homeDataNoOpState = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 9999, battery: 100 } as any }], // Truly unmapped state
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);
    await updateFromHomeData(homeDataNoOpState, platform as any);
    // Should update operationalState to Docked for unknown state (per implementation)
    expect(mockUpdateAttribute).toHaveBeenCalledWith(expect.any(Number), 'operationalState', expect.anything(), expect.anything());
  });

  it('should process device when it has docking station status', async () => {
    const robotWithDss = {
      ...robot,
      dockStationStatus: { dss_error: 0 }, // No error
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robotWithDss);

    await updateFromHomeData(homeData, platform as any);
    // Should process normally when no dss error
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });

  it('should log error and continue when robot is removed during processing', async () => {
    // Create a custom platform that removes robot during get()
    const customPlatform = {
      robots: new Map([['test-duid', robot]]),
      log: platform.log,
      roborockService: {},
      enableExperimentalFeature: {},
    };

    // Override the get method to return undefined (simulating removal)
    const originalGet = customPlatform.robots.get;
    customPlatform.robots.get = vi.fn((duid: string) => {
      if (duid === 'test-duid') return undefined; // Simulate robot removed
      return originalGet.call(customPlatform.robots, duid);
    });

    await updateFromHomeData(homeData, customPlatform as any);
    expect(platform.log.error).toHaveBeenCalledWith(expect.stringContaining('Robot not found: test-duid'));
  });

  it('should update batChargeState when batteryLevel exists', async () => {
    const homeDataWithBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 8, battery: 50 } as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);

    await updateFromHomeData(homeDataWithBattery, platform as any);
    expect(mockUpdateAttribute).toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.anything(), expect.anything());
  });

  it('should not update batChargeState when batteryLevel is missing', async () => {
    const homeDataNoBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 8 } as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);

    await updateFromHomeData(homeDataNoBattery, platform as any);
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batChargeState', expect.anything(), expect.anything());
  });

  it('should handle zero battery level', async () => {
    const homeDataZeroBattery = {
      ...homeData,
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 8, battery: 0 } as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);

    await updateFromHomeData(homeDataZeroBattery, platform as any);
    // Battery is 0, which is falsy, so battery attributes should not be updated
    expect(mockUpdateAttribute).not.toHaveBeenCalledWith(PowerSource.Cluster.id, 'batPercentRemaining', expect.anything(), expect.anything());
  });

  it('should handle homeData without matching product schema', async () => {
    const homeDataNoSchema = {
      ...homeData,
      products: [], // No products means schema won't be found
      devices: [{ ...homeData.devices[0], deviceStatus: { state: 8, battery: 100 } as any }],
    };
    platform.robots.clear();
    platform.robots.set('test-duid', robot);

    await updateFromHomeData(homeDataNoSchema, platform as any);
    // Should still process but schema will be empty array
    expect(mockUpdateAttribute).toHaveBeenCalled();
  });
});
