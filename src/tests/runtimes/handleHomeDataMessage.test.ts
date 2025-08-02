import { updateFromHomeData } from '../../runtimes/handleHomeDataMessage';
import { homeData } from '../testData/mockData';
import { PowerSource, RvcRunMode } from 'matterbridge/matter/clusters';

// Mocks
const mockUpdateAttribute = jest.fn();
const duid = 'test-duid';
const robot = {
  updateAttribute: mockUpdateAttribute,
  device: { data: { model: 'test-model' } as { model: string } | undefined },
  dockStationStatus: {},
};
const platform = {
  robots: new Map([[duid, robot]]),
  log: {
    error: jest.fn(),
    debug: jest.fn(),
    notice: jest.fn(),
    /* eslint-disable no-console */
    fatal: jest.fn().mockImplementation((message: string, ...arg: unknown[]) => console.info(message, ...arg)),
  },
  roborockService: {},
  enableExperimentalFeature: {},
};

describe('updateFromHomeData', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
});
