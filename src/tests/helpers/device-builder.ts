import { DeviceCategory } from '../../roborockCommunication/models/deviceCategory.js';
import { Device, DeviceModel, Protocol, UserData, Home } from '../../roborockCommunication/models/index.js';
import { RoomEntity } from '../../core/domain/entities/Room.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/protocolVersion.js';

/**
 * Fluent builder for creating Device objects in tests.
 * Provides sensible defaults for all required fields.
 */
export class DeviceBuilder {
  private device: Partial<Device> = {
    duid: 'test-duid-default',
    name: 'Test Vacuum',
    activeTime: Date.now() / 1000,
    createTime: Date.now() / 1000 - 86400,
    localKey: 'testLocalKey1234',
    productId: 'testProductId',
    online: true,
    fv: '1.0.0',
    pv: '1.0',
    sn: 'TEST-SN-123456',
    featureSet: '0',
    newFeatureSet: '0',
    deviceStatus: {
      [Protocol.error]: 0,
      [Protocol.status_update]: 8,
      [Protocol.battery]: 100,
    },
    silentOtaSwitch: false,
    rrHomeId: 12345,
    serialNumber: 'TEST-SN-123456',
    specs: {
      id: 'test-duid-default',
      firmwareVersion: '1.0.0',
      serialNumber: 'TEST-SN-123456',
      model: DeviceModel.Q5,
      protocol: ProtocolVersion.V1,
      category: DeviceCategory.VacuumCleaner,
      batteryLevel: 100,
      hasRealTimeConnection: true,
    },
    store: {
      userData: this.createDefaultUserData(),
      localKey: 'testLocalKey1234',
      pv: '1.0',
      model: DeviceModel.Q5,
      homeData: this.createDefaultHomeData(),
    },
    schema: [],
  };

  /**
   * Set the device unique identifier.
   */
  withDuid(duid: string): this {
    this.device.duid = duid;
    if (this.device.specs) this.device.specs.id = duid;
    return this;
  }

  /**
   * Set the device name.
   */
  withName(name: string): this {
    this.device.name = name;
    return this;
  }

  /**
   * Set the device model.
   */
  withModel(model: DeviceModel): this {
    if (this.device.specs) this.device.specs.model = model;
    if (this.device.store) this.device.store.model = model;
    return this;
  }

  /**
   * Set the battery level (0-100).
   */
  withBattery(level: number): this {
    const batteryLevel = Math.max(0, Math.min(100, level));
    if (this.device.deviceStatus) {
      this.device.deviceStatus[Protocol.battery] = batteryLevel;
    }
    if (this.device.specs) {
      this.device.specs.batteryLevel = batteryLevel;
    }
    return this;
  }

  /**
   * Set the device online status.
   */
  withOnlineStatus(online: boolean): this {
    this.device.online = online;
    return this;
  }

  /**
   * Set the firmware version.
   */
  withFirmwareVersion(version: string): this {
    this.device.fv = version;
    if (this.device.specs) this.device.specs.firmwareVersion = version;
    return this;
  }

  /**
   * Set the serial number.
   */
  withSerialNumber(sn: string): this {
    this.device.sn = sn;
    this.device.serialNumber = sn;
    if (this.device.specs) this.device.specs.serialNumber = sn;
    return this;
  }

  /**
   * Set the local key for authentication.
   */
  withLocalKey(key: string): this {
    this.device.localKey = key;
    if (this.device.store) this.device.store.localKey = key;
    return this;
  }

  /**
   * Set the protocol version.
   */
  withProtocolVersion(pv: string): this {
    this.device.pv = pv;
    if (this.device.store) this.device.store.pv = pv;
    return this;
  }

  /**
   * Set user data for the device.
   */
  withUserData(userData: UserData): this {
    if (this.device.store) {
      this.device.store.userData = userData;
    }
    return this;
  }

  /**
   * Set the home ID.
   */
  withHomeId(homeId: number): this {
    this.device.rrHomeId = homeId;
    return this;
  }

  /**
   * Add home data to the device store.
   */
  withHomeData(homeData: Home): this {
    if (this.device.store) {
      this.device.store.homeData = homeData;
    }
    return this;
  }

  /**
   * Build the device object.
   * @returns Complete Device instance
   */
  build(): Device {
    return this.device as Device;
  }

  /**
   * Creates default user data for testing.
   */
  private createDefaultUserData(): UserData {
    return {
      username: 'test-user',
      uid: 123456,
      tokentype: 'test',
      token: 'test-token-123',
      rruid: 'rr-test-uid',
      region: 'us',
      countrycode: '1',
      country: 'US',
      nickname: 'Test User',
      rriot: {
        u: 'test-u',
        s: 'test-s',
        h: 'test-h',
        k: 'test-k',
        r: {
          r: 'US',
          a: 'https://api-us.roborock.com',
          m: 'ssl://mqtt-us.roborock.com:8883',
          l: 'https://wood-us.roborock.com',
        },
      },
    };
  }

  /**
   * Creates default home data for testing.
   */
  private createDefaultHomeData(): Home {
    return {
      id: 12345,
      name: 'Test Home',
      products: [],
      devices: [],
      receivedDevices: [],
      rooms: [new RoomEntity(1, 'Living Room'), new RoomEntity(2, 'Kitchen')],
    };
  }
}

/**
 * Quick helper to create a basic test device.
 * @param overrides - Optional property overrides
 * @returns Device instance with defaults
 *
 * @example
 * ```typescript
 * const device = createTestDevice({ duid: 'my-device', battery: 50 });
 * ```
 */
export function createTestDevice(overrides?: Partial<Device>): Device {
  const builder = new DeviceBuilder();
  const device = builder.build();
  return { ...device, ...overrides };
}
