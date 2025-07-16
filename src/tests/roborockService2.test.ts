import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '../roborockService';
import { MessageProcessor } from '../roborockCommunication/broadcast/messageProcessor';
import { Device, DeviceStatus } from '../roborockCommunication';

jest.useFakeTimers();

describe('RoborockService - activateDeviceNotify', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let mockMessageProcessor: jest.Mocked<MessageProcessor>;
  let mockDeviceNotify: jest.Mock;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      notice: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockMessageProcessor = {
      getDeviceStatus: jest.fn(),
    } as any;

    mockDeviceNotify = jest.fn(() => {
      jest.fn();
    });

    roborockService = new RoborockService(jest.fn(), jest.fn(), 1, {} as any, mockLogger); // refreshInterval = 1
    roborockService['deviceNotify'] = mockDeviceNotify;
    roborockService['getMessageProcessor'] = jest.fn().mockReturnValue(mockMessageProcessor);
    roborockService['refreshInterval'] = 1;
  });

  it('should call getDeviceStatus periodically and notify with status message', async () => {
    const duid = 'test-duid';
    const device: Device = { duid } as Device;

    const fakeStatus: DeviceStatus = {
      errorStatus: { errorCode: 0 },
      message: { battery: 80 },
    } as any;

    (roborockService['getMessageProcessor'] as jest.Mock).mockReturnValue(mockMessageProcessor);
    mockMessageProcessor.getDeviceStatus.mockResolvedValue(fakeStatus);

    await roborockService.activateDeviceNotify(device);

    jest.advanceTimersByTime(2000); // 1s = 1 cycle

    expect(mockLogger.debug).toHaveBeenCalledWith('Requesting device info for device', duid);
    expect(mockMessageProcessor.getDeviceStatus).toHaveBeenCalledWith(duid);
  });

  it('should log error if message processor is not found', async () => {
    const duid = 'not-found-duid';
    const device: Device = { duid } as Device;

    (roborockService['getMessageProcessor'] as jest.Mock).mockReturnValue(undefined);

    await roborockService.activateDeviceNotify(device);

    jest.advanceTimersByTime(1000); // trigger the interval

    expect(mockLogger.error).toHaveBeenCalledWith('Local client not initialized');
    expect(mockDeviceNotify).not.toHaveBeenCalled();
  });
});
