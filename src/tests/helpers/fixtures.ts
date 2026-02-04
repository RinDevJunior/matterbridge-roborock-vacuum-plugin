import { Device, DeviceData, DeviceInformation, Home } from '../../roborockCommunication/models/index.js';
import { DeviceModel } from '../../roborockCommunication/models/deviceModel.js';
import { DeviceCategory } from '../../roborockCommunication/models/deviceCategory.js';
import { RoomEntity } from '../../core/domain/entities/Room.js';

/**
 * Create a minimal valid Device instance for tests.
 * Override any fields via the `overrides` parameter.
 */
export function makeDeviceFixture(overrides: Partial<Device> = {}): Device {
  const baseData: DeviceData = {
    id: 'device-id',
    firmwareVersion: '01.00.00',
    serialNumber: 'SN123456',
    model: DeviceModel.S6,
    category: DeviceCategory.VacuumCleaner,
    batteryLevel: 100,
  };

  const baseStore: DeviceInformation = {
    userData: {
      username: 'tester',
      uid: 0,
      tokentype: 'Bearer',
      token: 'token',
      rruid: 'rrid',
      region: 'us',
      countrycode: 'US',
      country: 'US',
      nickname: 'tester',
      rriot: { u: '', s: '', h: '', k: '', r: { a: '', m: '', r: '', l: '' } },
    },
    localKey: 'local-key',
    pv: '1.0',
    model: DeviceModel.S6,
    homeData: {
      id: 1,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(1, 'Living Room'), new RoomEntity(2, 'Kitchen')],
    } satisfies Home,
  };

  const base: Device = {
    duid: 'duid-1',
    name: 'Test Vacuum',
    sn: 'SN123456',
    serialNumber: 'SN123456',
    activeTime: Date.now(),
    createTime: Date.now(),
    localKey: 'local-key',
    pv: '1.0',
    online: true,
    productId: 'product-id',
    rrHomeId: 1,
    fv: '01.00.00',
    deviceStatus: {},
    schema: [],
    data: baseData,
    store: baseStore,
    scenes: [],
    mapInfos: undefined,
  } as Device;

  return { ...base, ...overrides } as Device;
}
