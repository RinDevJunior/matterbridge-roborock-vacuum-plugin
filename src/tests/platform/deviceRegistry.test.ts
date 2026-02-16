import { describe, it, expect, beforeEach } from 'vitest';
import { DeviceRegistry } from '../../platform/deviceRegistry.js';
import { DeviceModel, type Device } from '../../roborockCommunication/models/index.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import { DeviceCategory } from '../../roborockCommunication/models/deviceCategory.js';
import { asType } from '../testUtils.js';
import { ProtocolVersion } from '../../roborockCommunication/enums/index.js';

function createMockDevice(serialNumber: string): Device {
  return {
    duid: `duid-${serialNumber}`,
    name: `Device ${serialNumber}`,
    sn: serialNumber,
    serialNumber,
    activeTime: Date.now(),
    createTime: Date.now(),
    localKey: 'test-key',
    pv: '1.0',
    online: true,
    productId: 'test-product',
    rrHomeId: 123,
    fv: '1.0.0',
    deviceStatus: {},
    schema: [],
    specs: {
      id: `id-${serialNumber}`,
      firmwareVersion: '1.0.0',
      serialNumber,
      model: DeviceModel.Q7_MAX,
      protocol: ProtocolVersion.V1,
      category: DeviceCategory.VacuumCleaner,
      batteryLevel: 100,
      hasRealTimeConnection: true,
    },
    store: {
      userData: {
        username: 'test',
        uid: 'uid',
        tokentype: '',
        token: '',
        rruid: '',
        region: 'US',
        countrycode: '',
        country: '',
        nickname: 'nick',
        rriot: { u: '', s: '', h: '', k: '', r: { r: '', a: '', m: '', l: '' } },
      },
      localKey: 'test-key',
      pv: '1.0',
      model: DeviceModel.Q7_MAX,
      homeData: {
        id: 123,
        name: 'Test Home',
        products: [],
        devices: [],
        receivedDevices: [],
        rooms: [],
      },
    },
    scenes: [],
    mapInfos: undefined,
  } as Device;
}

function createMockRobot(serialNumber: string): RoborockVacuumCleaner {
  return {
    serialNumber,
    device: createMockDevice(serialNumber),
    username: 'test@example.com',
  } as RoborockVacuumCleaner;
}

let registry: DeviceRegistry;

beforeEach(() => {
  registry = new DeviceRegistry();
});

describe('DeviceRegistry', () => {
  describe('register', () => {
    it('should register both device and robot', () => {
      const device = createMockDevice('SN001');
      const robot = createMockRobot('SN001');

      registry.register(device, robot);

      expect(registry.getDevice('SN001')).toBe(device);
      expect(registry.getRobot('SN001')).toBe(robot);
    });

    it('should not register when device has no serialNumber', () => {
      const device = createMockDevice('SN001');
      device.serialNumber = '';
      const robot = createMockRobot('SN001');

      registry.register(device, robot);

      expect(registry.size).toBe(0);
    });

    it('should not register when device is null', () => {
      const robot = createMockRobot('SN001');

      registry.register(asType<Device>(undefined), robot);

      expect(registry.size).toBe(0);
    });

    it('should not register when device is undefined', () => {
      const robot = createMockRobot('SN001');

      registry.register(asType<Device>(undefined), robot);

      expect(registry.size).toBe(0);
    });

    it('should overwrite existing registration for same serialNumber', () => {
      const device1 = createMockDevice('SN001');
      const robot1 = createMockRobot('SN001');
      const device2 = createMockDevice('SN001');
      const robot2 = createMockRobot('SN001');

      registry.register(device1, robot1);
      registry.register(device2, robot2);

      expect(registry.getDevice('SN001')).toBe(device2);
      expect(registry.getRobot('SN001')).toBe(robot2);
      expect(registry.size).toBe(1);
    });
  });

  describe('registerRobot', () => {
    it('should register only robot', () => {
      const robot = createMockRobot('SN001');

      registry.registerRobot(robot);

      expect(registry.getRobot('SN001')).toBe(robot);
      expect(registry.getDevice('SN001')).toBeUndefined();
    });

    it('should not register when robot has no serialNumber', () => {
      const robot = createMockRobot('SN001');
      robot.serialNumber = '';

      registry.registerRobot(robot);

      expect(registry.getRobot('SN001')).toBeUndefined();
    });

    it('should not register when robot is null', () => {
      registry.registerRobot(asType<RoborockVacuumCleaner>(undefined));

      expect(registry.getAllRobots()).toHaveLength(0);
    });

    it('should not register when robot is undefined', () => {
      registry.registerRobot(asType<RoborockVacuumCleaner>(undefined));

      expect(registry.getAllRobots()).toHaveLength(0);
    });

    it('should overwrite existing robot for same serialNumber', () => {
      const robot1 = createMockRobot('SN001');
      const robot2 = createMockRobot('SN001');

      registry.registerRobot(robot1);
      registry.registerRobot(robot2);

      expect(registry.getRobot('SN001')).toBe(robot2);
      expect(registry.getAllRobots()).toHaveLength(1);
    });
  });

  describe('registerDevice', () => {
    it('should register only device', () => {
      const device = createMockDevice('SN001');

      registry.registerDevice(device);

      expect(registry.getDevice('SN001')).toBe(device);
      expect(registry.getRobot('SN001')).toBeUndefined();
    });

    it('should not register when device has no serialNumber', () => {
      const device = createMockDevice('SN001');
      device.serialNumber = '';

      registry.registerDevice(device);

      expect(registry.getDevice('SN001')).toBeUndefined();
    });

    it('should not register when device is null', () => {
      registry.registerDevice(asType<Device>(undefined));

      expect(registry.size).toBe(0);
    });

    it('should not register when device is undefined', () => {
      registry.registerDevice(asType<Device>(undefined));

      expect(registry.size).toBe(0);
    });

    it('should overwrite existing device for same serialNumber', () => {
      const device1 = createMockDevice('SN001');
      const device2 = createMockDevice('SN001');

      registry.registerDevice(device1);
      registry.registerDevice(device2);

      expect(registry.getDevice('SN001')).toBe(device2);
      expect(registry.size).toBe(1);
    });
  });

  describe('unregister', () => {
    it('should unregister both device and robot', () => {
      const device = createMockDevice('SN001');
      const robot = createMockRobot('SN001');
      registry.register(device, robot);

      registry.unregister('SN001');

      expect(registry.getDevice('SN001')).toBeUndefined();
      expect(registry.getRobot('SN001')).toBeUndefined();
      expect(registry.size).toBe(0);
    });

    it('should handle unregistering non-existent serialNumber', () => {
      registry.unregister('NON_EXISTENT');

      expect(registry.size).toBe(0);
    });

    it('should only affect specified serialNumber', () => {
      const device1 = createMockDevice('SN001');
      const robot1 = createMockRobot('SN001');
      const device2 = createMockDevice('SN002');
      const robot2 = createMockRobot('SN002');

      registry.register(device1, robot1);
      registry.register(device2, robot2);
      registry.unregister('SN001');

      expect(registry.getDevice('SN001')).toBeUndefined();
      expect(registry.getRobot('SN001')).toBeUndefined();
      expect(registry.getDevice('SN002')).toBe(device2);
      expect(registry.getRobot('SN002')).toBe(robot2);
      expect(registry.size).toBe(1);
    });
  });

  describe('getRobot', () => {
    it('should return robot by serialNumber', () => {
      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      const result = registry.getRobot('SN001');

      expect(result).toBe(robot);
    });

    it('should return undefined for non-existent serialNumber', () => {
      const result = registry.getRobot('NON_EXISTENT');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty registry', () => {
      const result = registry.getRobot('SN001');

      expect(result).toBeUndefined();
    });
  });

  describe('getDevice', () => {
    it('should return device by serialNumber', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      const result = registry.getDevice('SN001');

      expect(result).toBe(device);
    });

    it('should return undefined for non-existent serialNumber', () => {
      const result = registry.getDevice('NON_EXISTENT');

      expect(result).toBeUndefined();
    });

    it('should return undefined for empty registry', () => {
      const result = registry.getDevice('SN001');

      expect(result).toBeUndefined();
    });
  });

  describe('getAllRobots', () => {
    it('should return all registered robots', () => {
      const robot1 = createMockRobot('SN001');
      const robot2 = createMockRobot('SN002');
      const robot3 = createMockRobot('SN003');

      registry.registerRobot(robot1);
      registry.registerRobot(robot2);
      registry.registerRobot(robot3);

      const result = registry.getAllRobots();

      expect(result).toHaveLength(3);
      expect(result).toContain(robot1);
      expect(result).toContain(robot2);
      expect(result).toContain(robot3);
    });

    it('should return empty array for empty registry', () => {
      const result = registry.getAllRobots();

      expect(result).toEqual([]);
    });

    it('should return new array instance each time', () => {
      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      const result1 = registry.getAllRobots();
      const result2 = registry.getAllRobots();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('getAllDevices', () => {
    it('should return all registered devices', () => {
      const device1 = createMockDevice('SN001');
      const device2 = createMockDevice('SN002');
      const device3 = createMockDevice('SN003');

      registry.registerDevice(device1);
      registry.registerDevice(device2);
      registry.registerDevice(device3);

      const result = registry.getAllDevices();

      expect(result).toHaveLength(3);
      expect(result).toContain(device1);
      expect(result).toContain(device2);
      expect(result).toContain(device3);
    });

    it('should return empty array for empty registry', () => {
      const result = registry.getAllDevices();

      expect(result).toEqual([]);
    });

    it('should return new array instance each time', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      const result1 = registry.getAllDevices();
      const result2 = registry.getAllDevices();

      expect(result1).not.toBe(result2);
      expect(result1).toEqual(result2);
    });
  });

  describe('size', () => {
    it('should return 0 for empty registry', () => {
      expect(registry.size).toBe(0);
    });

    it('should return number of registered devices', () => {
      const device1 = createMockDevice('SN001');
      const device2 = createMockDevice('SN002');

      registry.registerDevice(device1);
      expect(registry.size).toBe(1);

      registry.registerDevice(device2);
      expect(registry.size).toBe(2);
    });

    it('should count only devices not robots', () => {
      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      expect(registry.size).toBe(0);
    });

    it('should count correctly when using register method', () => {
      const device = createMockDevice('SN001');
      const robot = createMockRobot('SN001');

      registry.register(device, robot);

      expect(registry.size).toBe(1);
    });

    it('should decrease after unregister', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      expect(registry.size).toBe(1);

      registry.unregister('SN001');

      expect(registry.size).toBe(0);
    });
  });

  describe('hasDevices', () => {
    it('should return false for empty registry', () => {
      expect(registry.hasDevices()).toBe(false);
    });

    it('should return true when devices registered', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      expect(registry.hasDevices()).toBe(true);
    });

    it('should return false when only robots registered', () => {
      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      expect(registry.hasDevices()).toBe(false);
    });

    it('should return false after clearing', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      registry.clear();

      expect(registry.hasDevices()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all devices and robots', () => {
      const device1 = createMockDevice('SN001');
      const robot1 = createMockRobot('SN001');
      const device2 = createMockDevice('SN002');
      const robot2 = createMockRobot('SN002');

      registry.register(device1, robot1);
      registry.register(device2, robot2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAllRobots()).toHaveLength(0);
      expect(registry.getAllDevices()).toHaveLength(0);
      expect(registry.getDevice('SN001')).toBeUndefined();
      expect(registry.getRobot('SN001')).toBeUndefined();
    });

    it('should handle clearing empty registry', () => {
      registry.clear();

      expect(registry.size).toBe(0);
    });

    it('should allow registering after clearing', () => {
      const device1 = createMockDevice('SN001');
      registry.registerDevice(device1);

      registry.clear();

      const device2 = createMockDevice('SN002');
      registry.registerDevice(device2);

      expect(registry.size).toBe(1);
      expect(registry.getDevice('SN002')).toBe(device2);
    });
  });

  describe('robotEntries', () => {
    it('should iterate over all robot entries', () => {
      const robot1 = createMockRobot('SN001');
      const robot2 = createMockRobot('SN002');

      registry.registerRobot(robot1);
      registry.registerRobot(robot2);

      const entries = Array.from(registry.robotEntries());

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['SN001', robot1]);
      expect(entries).toContainEqual(['SN002', robot2]);
    });

    it('should return empty iterator for empty registry', () => {
      const entries = Array.from(registry.robotEntries());

      expect(entries).toEqual([]);
    });

    it('should support for...of loop', () => {
      const robot1 = createMockRobot('SN001');
      const robot2 = createMockRobot('SN002');

      registry.registerRobot(robot1);
      registry.registerRobot(robot2);

      const serialNumbers: string[] = [];
      for (const [sn, _robot] of registry.robotEntries()) {
        serialNumbers.push(sn);
      }

      expect(serialNumbers).toContain('SN001');
      expect(serialNumbers).toContain('SN002');
    });
  });

  describe('deviceEntries', () => {
    it('should iterate over all device entries', () => {
      const device1 = createMockDevice('SN001');
      const device2 = createMockDevice('SN002');

      registry.registerDevice(device1);
      registry.registerDevice(device2);

      const entries = Array.from(registry.deviceEntries());

      expect(entries).toHaveLength(2);
      expect(entries).toContainEqual(['SN001', device1]);
      expect(entries).toContainEqual(['SN002', device2]);
    });

    it('should return empty iterator for empty registry', () => {
      const entries = Array.from(registry.deviceEntries());

      expect(entries).toEqual([]);
    });

    it('should support for...of loop', () => {
      const device1 = createMockDevice('SN001');
      const device2 = createMockDevice('SN002');

      registry.registerDevice(device1);
      registry.registerDevice(device2);

      const serialNumbers: string[] = [];
      for (const [sn, _device] of registry.deviceEntries()) {
        serialNumbers.push(sn);
      }

      expect(serialNumbers).toContain('SN001');
      expect(serialNumbers).toContain('SN002');
    });
  });

  describe('robotsMap', () => {
    it('should return the internal robots map', () => {
      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      const map = registry.robotsMap;

      expect(map).toBeInstanceOf(Map);
      expect(map.get('SN001')).toBe(robot);
    });

    it('should return same map instance', () => {
      const map1 = registry.robotsMap;
      const map2 = registry.robotsMap;

      expect(map1).toBe(map2);
    });

    it('should reflect changes made through registry', () => {
      const map = registry.robotsMap;

      const robot = createMockRobot('SN001');
      registry.registerRobot(robot);

      expect(map.get('SN001')).toBe(robot);
    });
  });

  describe('devicesMap', () => {
    it('should return the internal devices map', () => {
      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      const map = registry.devicesMap;

      expect(map).toBeInstanceOf(Map);
      expect(map.get('SN001')).toBe(device);
    });

    it('should return same map instance', () => {
      const map1 = registry.devicesMap;
      const map2 = registry.devicesMap;

      expect(map1).toBe(map2);
    });

    it('should reflect changes made through registry', () => {
      const map = registry.devicesMap;

      const device = createMockDevice('SN001');
      registry.registerDevice(device);

      expect(map.get('SN001')).toBe(device);
    });
  });

  describe('integration scenarios', () => {
    it('should handle mixed operations correctly', () => {
      const device1 = createMockDevice('SN001');
      const robot1 = createMockRobot('SN001');
      const device2 = createMockDevice('SN002');
      const robot2 = createMockRobot('SN002');

      registry.register(device1, robot1);
      registry.registerDevice(device2);
      registry.registerRobot(robot2);

      expect(registry.size).toBe(2);
      expect(registry.getAllRobots()).toHaveLength(2);
      expect(registry.getDevice('SN001')).toBe(device1);
      expect(registry.getDevice('SN002')).toBe(device2);
      expect(registry.getRobot('SN001')).toBe(robot1);
      expect(registry.getRobot('SN002')).toBe(robot2);
    });

    describe('edge cases and error handling', () => {
      it('should not throw when unregistering empty string', () => {
        expect(() => registry.unregister('')).not.toThrow();
        expect(registry.size).toBe(0);
      });

      it('should not throw when unregistering undefined', () => {
        // @ts-expect-error: purposely passing undefined
        expect(() => registry.unregister(undefined)).not.toThrow();
        expect(registry.size).toBe(0);
      });

      it('should not throw when clearing already empty registry', () => {
        expect(() => registry.clear()).not.toThrow();
        expect(registry.size).toBe(0);
      });

      it('should allow direct map manipulation and reflect in registry', () => {
        const device = createMockDevice('SN001');
        const robot = createMockRobot('SN001');
        registry.devicesMap.set('SN001', device);
        registry.robotsMap.set('SN001', robot);
        expect(registry.getDevice('SN001')).toBe(device);
        expect(registry.getRobot('SN001')).toBe(robot);
        registry.devicesMap.delete('SN001');
        registry.robotsMap.delete('SN001');
        expect(registry.getDevice('SN001')).toBeUndefined();
        expect(registry.getRobot('SN001')).toBeUndefined();
      });

      it('should handle registering device and robot with mismatched serialNumbers', () => {
        const device = createMockDevice('SN001');
        const robot = createMockRobot('SN002');
        registry.register(device, robot);
        // Both device and robot are registered under device.serialNumber (SN001)
        expect(registry.getDevice('SN001')).toBe(device);
        expect(registry.getRobot('SN001')).toBe(robot);
        expect(registry.getRobot('SN002')).toBeUndefined();
      });

      it('should not register robot if serialNumber is null or undefined', () => {
        const robot = createMockRobot('SN001');
        robot.serialNumber = undefined;
        registry.registerRobot(robot);
        expect(registry.getAllRobots()).toHaveLength(0);
      });

      it('should not register device if serialNumber is null or undefined', () => {
        const device = createMockDevice('SN001');
        // @ts-expect-error: purposely setting serialNumber to null
        device.serialNumber = null;
        registry.registerDevice(device);
        expect(registry.size).toBe(0);
        // @ts-expect-error: purposely setting serialNumber to undefined
        device.serialNumber = undefined;
        registry.registerDevice(device);
        expect(registry.size).toBe(0);
      });
    });

    it('should handle partial registration and unregistration', () => {
      const device = createMockDevice('SN001');
      const robot = createMockRobot('SN002');

      registry.registerDevice(device);
      registry.registerRobot(robot);

      expect(registry.size).toBe(1);
      expect(registry.getAllRobots()).toHaveLength(1);

      registry.unregister('SN001');

      expect(registry.size).toBe(0);
      expect(registry.getAllRobots()).toHaveLength(1);
    });

    it('should support complete workflow: register -> get -> unregister -> verify', () => {
      const device = createMockDevice('SN001');
      const robot = createMockRobot('SN001');

      registry.register(device, robot);
      expect(registry.size).toBe(1);
      expect(registry.hasDevices()).toBe(true);

      const retrievedDevice = registry.getDevice('SN001');
      const retrievedRobot = registry.getRobot('SN001');
      expect(retrievedDevice).toBe(device);
      expect(retrievedRobot).toBe(robot);

      registry.unregister('SN001');
      expect(registry.size).toBe(0);
      expect(registry.hasDevices()).toBe(false);
      expect(registry.getDevice('SN001')).toBeUndefined();
      expect(registry.getRobot('SN001')).toBeUndefined();
    });
  });
});
