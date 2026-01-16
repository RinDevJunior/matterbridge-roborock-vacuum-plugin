/**
 * Device builder utility for creating test device objects.
 * Provides a fluent API for constructing Device instances with sensible defaults.
 * @module tests/helpers/device-builder
 */

import type { Device, UserData } from '../../roborockCommunication/index.js';
import { DeviceModel } from '../../roborockCommunication/Zmodel/deviceModel.js';
import { Protocol } from '../../roborockCommunication/index.js';

/**
 * Fluent builder for creating Device objects in tests.
 * Provides sensible defaults for all required fields.
 *
 * @example
 * ```typescript
 * const device = new DeviceBuilder()
 *   .withDuid('test-device-123')
 *   .withModel(DeviceModel.Q5)
 *   .withBattery(85)
 *   .build();
 * ```
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
    rooms: [],
    serialNumber: 'TEST-SN-123456',
    data: {
      id: 'test-duid-default',
      firmwareVersion: '1.0.0',
      serialNumber: 'TEST-SN-123456',
      model: DeviceModel.Q5,
      category: 'robot.vacuum.cleaner',
      batteryLevel: 100,
    },
    store: {
      userData: this.createDefaultUserData(),
      localKey: 'testLocalKey1234',
      pv: '1.0',
      model: DeviceModel.Q5,
    },
    schema: [],
  };

  /**
   * Set the device unique identifier.
   */
  withDuid(duid: string): this {
    this.device.duid = duid;
    if (this.device.data) this.device.data.id = duid;
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
    if (this.device.data) this.device.data.model = model;
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
    if (this.device.data) {
      this.device.data.batteryLevel = batteryLevel;
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
    if (this.device.data) this.device.data.firmwareVersion = version;
    return this;
  }

  /**
   * Set the serial number.
   */
  withSerialNumber(sn: string): this {
    this.device.sn = sn;
    this.device.serialNumber = sn;
    if (this.device.data) this.device.data.serialNumber = sn;
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
   * Add rooms to the device.
   */
  withRooms(rooms: { id: number; name: string }[]): this {
    this.device.rooms = rooms;
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
