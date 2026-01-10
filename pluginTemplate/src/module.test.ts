const MATTER_PORT = 6000;
const NAME = 'Platform';
const HOMEDIR = path.join('jest', NAME);

process.argv = ['node', 'platform.test.js', '-novirtual', '-frontend', '0', '-homedir', HOMEDIR, '-port', MATTER_PORT.toString()];

import path from 'node:path';

import { jest } from '@jest/globals';
import { MatterbridgeEndpoint, invokeSubscribeHandler } from 'matterbridge';
import { AnsiLogger, LogLevel, TimestampFormat } from 'matterbridge/logger';
import {
  ColorControlCluster,
  DoorLock,
  DoorLockCluster,
  FanControl,
  FanControlCluster,
  IdentifyCluster,
  LevelControlCluster,
  ModeSelectCluster,
  OnOffCluster,
  Thermostat,
  ThermostatCluster,
  WindowCovering,
  WindowCoveringCluster,
} from 'matterbridge/matter/clusters';
import {
  loggerLogSpy,
  setupTest,
  createMatterbridgeEnvironment,
  startMatterbridgeEnvironment,
  stopMatterbridgeEnvironment,
  destroyMatterbridgeEnvironment,
  addBridgedEndpointSpy,
  removeBridgedEndpointSpy,
  removeAllBridgedEndpointsSpy,
  matterbridge,
  server,
  addMatterbridgePlatform,
} from 'matterbridge/jestutils';

import initializePlugin, { DynamicPlatformConfig, ExampleMatterbridgeDynamicPlatform } from './module.js';

// Setup the test environment
setupTest(NAME, false);

describe('TestPlatform', () => {
  let device: MatterbridgeEndpoint;
  let dynamicPlatform: ExampleMatterbridgeDynamicPlatform;
  const log = new AnsiLogger({ logName: NAME, logTimestampFormat: TimestampFormat.TIME_MILLIS, logLevel: LogLevel.DEBUG });

  const config: DynamicPlatformConfig = {
    name: 'matterbridge-example-dynamic-platform',
    type: 'DynamicPlatform',
    version: '1.0.0',
    whiteList: [],
    blackList: [],
    useInterval: true,
    enableServerRvc: true,
    debug: true,
    unregisterOnShutdown: false,
  };

  beforeAll(async () => {
    await createMatterbridgeEnvironment(NAME);
    await startMatterbridgeEnvironment(MATTER_PORT);
  });

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await stopMatterbridgeEnvironment();
    await destroyMatterbridgeEnvironment();
    // Restore all mocks
    jest.restoreAllMocks();
  });

  it('should return an instance of the platform', async () => {
    dynamicPlatform = initializePlugin(matterbridge, log, config);
    expect(dynamicPlatform).toBeInstanceOf(ExampleMatterbridgeDynamicPlatform);
    await dynamicPlatform.onShutdown();
  });

  it('should throw error in load when version is not valid', () => {
    matterbridge.matterbridgeVersion = '1.5.0';
    expect(() => new ExampleMatterbridgeDynamicPlatform(matterbridge, log, config)).toThrow(
      'This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge from 1.5.0 to the latest version in the frontend.',
    );
    matterbridge.matterbridgeVersion = '3.4.0';
  });

  it('should initialize platform with config name and set the default config', () => {
    dynamicPlatform = new ExampleMatterbridgeDynamicPlatform(matterbridge, log, config);
    addMatterbridgePlatform(dynamicPlatform);
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
    expect(config.whiteList).toEqual([]);
    expect(config.blackList).toEqual([]);
    expect(config.useInterval).toBe(true);
    expect(config.enableServerRvc).toBe(true);
  });

  it('should call onShutdown with reason and remove the devices', async () => {
    config.unregisterOnShutdown = true;
    await dynamicPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    expect(removeBridgedEndpointSpy).toHaveBeenCalledTimes(0);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalledTimes(1);
    config.unregisterOnShutdown = false;
  });

  it('should initialize platform with config name', () => {
    dynamicPlatform = new ExampleMatterbridgeDynamicPlatform(matterbridge, log, config);
    addMatterbridgePlatform(dynamicPlatform);
    dynamicPlatform.version = '1.6.6';
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Initializing platform:', config.name);
  });

  it('should call onStart without reason and add no devices', async () => {
    config.whiteList = ['No devices'];
    config.blackList = [];
    await dynamicPlatform.onStart();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'none');
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(0);
  });

  it('should call onShutdown with reason and cleanup the interval', async () => {
    await dynamicPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    expect(removeBridgedEndpointSpy).toHaveBeenCalledTimes(0);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalledTimes(0);
  });

  it('should call onStart with reason and add all the devices', async () => {
    config.whiteList = [];
    config.blackList = [];
    dynamicPlatform.version = '';

    await dynamicPlatform.onStart('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onStart called with reason:', 'Test reason');
    expect(addBridgedEndpointSpy).toHaveBeenCalledTimes(58);
  });

  it('should execute the commandHandlers', async () => {
    // Invoke command handlers
    for (const [key, device] of Array.from(dynamicPlatform.bridgedDevices)) {
      expect(device).toBeDefined();

      if (device.hasClusterServer(IdentifyCluster)) {
        jest.clearAllMocks();
        await device.executeCommandHandler('identify', { identifyTime: 5 });
        await device.executeCommandHandler('triggerEffect', { effectIdentifier: 0, effectVariant: 0 });
      }

      if (device.hasClusterServer(OnOffCluster)) {
        await device.executeCommandHandler('on');
        await device.executeCommandHandler('off');
        await device.executeCommandHandler('toggle');
      }

      if (device.hasClusterServer(ModeSelectCluster)) {
        await device.executeCommandHandler('changeToMode', { mode: 1 });
      }

      if (device.hasClusterServer(LevelControlCluster)) {
        await device.executeCommandHandler('moveToLevel', { level: 1 });
        await device.executeCommandHandler('moveToLevelWithOnOff', { level: 1 });
      }

      if (device.hasClusterServer(ColorControlCluster)) {
        await device.executeCommandHandler('moveToColor', { hue: 50, saturation: 100, colorX: 0.5, colorY: 0.5, colorTemperatureMireds: 300 });
        await device.executeCommandHandler('moveToHue', { hue: 50, saturation: 100, colorX: 0.5, colorY: 0.5, colorTemperatureMireds: 300 });
        await device.executeCommandHandler('moveToSaturation', { hue: 50, saturation: 100, colorX: 0.5, colorY: 0.5, colorTemperatureMireds: 300 });
        await device.executeCommandHandler('moveToHueAndSaturation', { hue: 50, saturation: 100, colorX: 0.5, colorY: 0.5, colorTemperatureMireds: 300 });
        await device.executeCommandHandler('moveToColorTemperature', { hue: 50, saturation: 100, colorX: 0.5, colorY: 0.5, colorTemperatureMireds: 300 });
      }

      if (device.hasClusterServer(WindowCoveringCluster.with(WindowCovering.Feature.Lift, WindowCovering.Feature.PositionAwareLift))) {
        await device.executeCommandHandler('upOrOpen');
        await device.executeCommandHandler('downOrClose');
        await device.executeCommandHandler('stopMotion');
        await device.executeCommandHandler('goToLiftPercentage', { liftPercent100thsValue: 5000 });
        if (device.deviceName === 'Cover lift and tilt') {
          await device.executeCommandHandler('goToTiltPercentage', { tiltPercent100thsValue: 5000 });
        }
      }

      if (device.hasClusterServer(DoorLockCluster)) {
        await device.executeCommandHandler('lockDoor');
        await device.executeCommandHandler('unlockDoor');
        await device.setAttribute(DoorLockCluster.id, 'operatingMode', DoorLock.OperatingMode.NoRemoteLockUnlock);
        await device.setAttribute(DoorLockCluster.id, 'operatingMode', DoorLock.OperatingMode.Normal);
      }

      if (device.hasClusterServer(FanControlCluster)) {
        await device.executeCommandHandler('step', { direction: FanControl.StepDirection.Increase });
        await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.Off);
        await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.Low);
        await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.Medium);
        await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.High);
        await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.On);
        if (device.deviceName === 'Fan auto') {
          await device.setAttribute(FanControlCluster.id, 'fanMode', FanControl.FanMode.Auto);
        }

        await device.setAttribute(FanControlCluster.id, 'percentSetting', 50);
        await device.setAttribute(FanControlCluster.id, 'percentSetting', 10);

        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.Off, FanControl.FanMode.Off);
        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.Low, FanControl.FanMode.Low);
        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.Medium, FanControl.FanMode.Medium);
        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.High, FanControl.FanMode.High);
        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.On, FanControl.FanMode.On);
        await invokeSubscribeHandler(device, 'fanControl', 'fanMode', FanControl.FanMode.Auto, FanControl.FanMode.Auto);
        await invokeSubscribeHandler(device, 'fanControl', 'percentSetting', 30, 30);
        await invokeSubscribeHandler(device, 'fanControl', 'rockSetting', {}, {});
        await invokeSubscribeHandler(device, 'fanControl', 'windSetting', {}, {});
        await invokeSubscribeHandler(device, 'fanControl', 'airflowDirection', {}, {});
      }

      if (device.hasClusterServer(ThermostatCluster.with(Thermostat.Feature.Heating, Thermostat.Feature.Cooling, Thermostat.Feature.AutoMode))) {
        await device.executeCommandHandler('setpointRaiseLower', { mode: Thermostat.SetpointRaiseLowerMode.Both, amount: 100 });
        if (device.deviceName === 'Thermostat (AutoMode)' || device.deviceName === 'Thermostat (AutoOccupancy)') {
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Off);
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat);
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Cool);
        }
        if (device.deviceName === 'Thermostat (AutoMode)' || device.deviceName === 'Thermostat (AutoOccupancy)' || device.deviceName === 'Thermostat (Heat)') {
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Off);
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Heat);
          await device.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', 2800);
          await device.setAttribute(ThermostatCluster.id, 'occupiedHeatingSetpoint', 2700);
        }
        if (device.deviceName === 'Thermostat (AutoMode)' || device.deviceName === 'Thermostat (AutoOccupancy)' || device.deviceName === 'Thermostat (Cool)') {
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Off);
          await device.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Cool);
          await device.setAttribute(ThermostatCluster.id, 'occupiedCoolingSetpoint', 1500);
          await device.setAttribute(ThermostatCluster.id, 'occupiedCoolingSetpoint', 1400);
        }
        if (device.deviceName === 'Thermostat (AutoOccupancy)') {
          await device.setAttribute(ThermostatCluster.id, 'unoccupiedHeatingSetpoint', 2800);
          await device.setAttribute(ThermostatCluster.id, 'unoccupiedHeatingSetpoint', 2700);
          await device.setAttribute(ThermostatCluster.id, 'unoccupiedCoolingSetpoint', 1500);
          await device.setAttribute(ThermostatCluster.id, 'unoccupiedCoolingSetpoint', 1400);
        }
        await invokeSubscribeHandler(device, 'Thermostat', 'systemMode', Thermostat.SystemMode.Off, Thermostat.SystemMode.Off);
        await invokeSubscribeHandler(device, 'Thermostat', 'occupiedHeatingSetpoint', 2800, 2700);
        await invokeSubscribeHandler(device, 'Thermostat', 'occupiedCoolingSetpoint', 1500, 1400);
        await invokeSubscribeHandler(device, 'Thermostat', 'unoccupiedHeatingSetpoint', 2000, 1900);
        await invokeSubscribeHandler(device, 'Thermostat', 'unoccupiedCoolingSetpoint', 2000, 1900);
      }
    }
  });

  it('should call onConfigure', async () => {
    jest.useFakeTimers();

    await dynamicPlatform.onConfigure();
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onConfigure called');

    // Simulate multiple interval executions
    for (let i = 0; i < 30; i++) {
      await jest.advanceTimersByTimeAsync(60 * 1000);
    }

    jest.useRealTimers();

    expect(loggerLogSpy).toHaveBeenCalled();
    expect(loggerLogSpy).not.toHaveBeenCalledWith(LogLevel.ERROR, expect.anything());
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Appliances animation phase 0');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'Appliances animation phase 10');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Switch.SinglePress'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Switch.DoublePress'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Switch.LongPress'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Switch.Press'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Switch.Release'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Set lock lockState to Unlocked'));
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, expect.stringContaining('Set lock lockState to Locked'));
  }, 60000);

  it('should call onShutdown with reason', async () => {
    await dynamicPlatform.onShutdown('Test reason');
    expect(loggerLogSpy).toHaveBeenCalledWith(LogLevel.INFO, 'onShutdown called with reason:', 'Test reason');
    expect(removeBridgedEndpointSpy).toHaveBeenCalledTimes(0);
    expect(removeAllBridgedEndpointsSpy).toHaveBeenCalledTimes(0);
  });
});
