/**
 * This file contains the class ExampleMatterbridgeDynamicPlatform.
 *
 * @file module.ts
 * @author Luca Liguori
 * @version 2.0.0
 * @license Apache-2.0
 *
 * Copyright 2023, 2024, 2025, 2026 Luca Liguori.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  MatterbridgeEndpoint,
  MatterbridgeDynamicPlatform,
  PlatformConfig,
  airQualitySensor,
  bridgedNode,
  colorTemperatureLight,
  coverDevice,
  dimmableLight,
  doorLockDevice,
  fanDevice,
  flowSensor,
  humiditySensor,
  onOffLight,
  onOffOutlet,
  onOffSwitch,
  powerSource,
  rainSensor,
  smokeCoAlarm,
  temperatureSensor,
  thermostatDevice,
  waterFreezeDetector,
  waterLeakDetector,
  airPurifier,
  pumpDevice,
  waterValve,
  genericSwitch,
  onOffMountedSwitch,
  dimmableMountedSwitch,
  extendedColorLight,
  pressureSensor,
  contactSensor,
  occupancySensor,
  lightSensor,
  modeSelect,
  PlatformMatterbridge,
} from 'matterbridge';
import {
  RoboticVacuumCleaner,
  LaundryWasher,
  WaterHeater,
  Evse,
  SolarPower,
  BatteryStorage,
  LaundryDryer,
  HeatPump,
  Dishwasher,
  ExtractorHood,
  MicrowaveOven,
  Oven,
  Cooktop,
  Refrigerator,
  AirConditioner,
  Speaker,
} from 'matterbridge/devices';
import { isValidBoolean, isValidNumber, isValidObject, isValidString } from 'matterbridge/utils';
import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { AreaNamespaceTag, LocationTag, NumberTag, PositionTag, RefrigeratorTag, SwitchesTag, UINT16_MAX, UINT32_MAX } from 'matterbridge/matter';
import {
  PowerSource,
  BooleanState,
  OnOff,
  LevelControl,
  AirQuality,
  CarbonDioxideConcentrationMeasurement,
  CarbonMonoxideConcentrationMeasurement,
  FlowMeasurement,
  ColorControl,
  DoorLock,
  FanControl,
  FormaldehydeConcentrationMeasurement,
  NitrogenDioxideConcentrationMeasurement,
  OzoneConcentrationMeasurement,
  Pm10ConcentrationMeasurement,
  Pm1ConcentrationMeasurement,
  Pm25ConcentrationMeasurement,
  RadonConcentrationMeasurement,
  RelativeHumidityMeasurement,
  RelativeHumidityMeasurementCluster,
  SmokeCoAlarm,
  TemperatureMeasurement,
  Thermostat,
  ThermostatCluster,
  TotalVolatileOrganicCompoundsConcentrationMeasurement,
  WindowCovering,
  EnergyEvseMode,
  EnergyEvse,
  RvcRunMode,
  RvcCleanMode,
  Descriptor,
  BridgedDeviceBasicInformation,
  OvenMode,
  OperationalState,
  OccupancySensing,
  IlluminanceMeasurement,
  PressureMeasurement,
  RefrigeratorAndTemperatureControlledCabinetMode,
  RvcOperationalState,
  DeviceEnergyManagement,
} from 'matterbridge/matter/clusters';

/**
 * Convert an illuminance value in lux to the Matter encoded representation used by the
 * IlluminanceMeasurement cluster. The Matter spec encodes illuminance logarithmically
 * as: value = round( 10000 * log10(lux) ), constrained to the range 0x0000 - 0xFFFE.
 * (0xFFFF is reserved / invalid.) Values at or below 0 lux are encoded as 0.
 *
 * Edge cases handled:
 *  - NaN / non‑finite / negative inputs -> treated as 0
 *  - Very large inputs -> capped at 0xFFFE
 *  - lux == 0 -> returns 0 (avoids -Infinity from log10(0))
 *
 * @param {number} lux Illuminance in lux (>= 0). Fractional values allowed.
 * @returns {number} Encoded Matter illuminance value (0 .. 0xFFFE)
 */
function luxToMatter(lux: number): number {
  if (!Number.isFinite(lux) || lux <= 0) return 0;
  const encoded = 10000 * Math.log10(lux);
  if (!Number.isFinite(encoded) || encoded < 0) return 0; // extra safety
  return Math.round(Math.min(encoded, 0xfffe));
}

/**
 * Convert a Matter encoded illuminance value back to lux. This is the inverse of
 * luxToMatter: lux = 10 ^ (value / 10000). Results are rounded to the nearest integer
 * lux for simplicity.
 *
 * Edge cases handled:
 *  - NaN / non‑finite / negative inputs -> treated as 0
 *  - Inputs > 0xFFFE are capped at 0xFFFE (0xFFFF is invalid per spec)
 *
 * @param {number} value Encoded Matter illuminance value (0 .. 0xFFFE)
 * @returns {number} Illuminance in lux (integer, >= 0)
 */
function matterToLux(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const v = Math.min(value, 0xfffe);
  const lux = Math.pow(10, v / 10000);
  return Math.round(lux < 0 ? 0 : lux);
}

export type DynamicPlatformConfig = PlatformConfig & {
  whiteList: string[];
  blackList: string[];
  useInterval: boolean;
  enableServerRvc: boolean;
};

/**
 * This is the standard interface for Matterbridge plugins.
 * Each plugin should export a default function that follows this signature.
 *
 * @param {PlatformMatterbridge} matterbridge - The Matterbridge instance.
 * @param {AnsiLogger} log - The logger instance.
 * @param {PlatformConfig} config - The platform configuration.
 * @returns {ExampleMatterbridgeDynamicPlatform} The initialized platform.
 */
export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): ExampleMatterbridgeDynamicPlatform {
  return new ExampleMatterbridgeDynamicPlatform(matterbridge, log, config as DynamicPlatformConfig);
}

export class ExampleMatterbridgeDynamicPlatform extends MatterbridgeDynamicPlatform {
  door: MatterbridgeEndpoint | undefined;
  occupancy: MatterbridgeEndpoint | undefined;
  illuminance: MatterbridgeEndpoint | undefined;
  temperature: MatterbridgeEndpoint | undefined;
  humidity: MatterbridgeEndpoint | undefined;
  pressure: MatterbridgeEndpoint | undefined;
  flow: MatterbridgeEndpoint | undefined;
  select: MatterbridgeEndpoint | undefined;
  climate: MatterbridgeEndpoint | undefined;
  switch: MatterbridgeEndpoint | undefined;
  mountedOnOffSwitch: MatterbridgeEndpoint | undefined;
  mountedDimmerSwitch: MatterbridgeEndpoint | undefined;
  lightOnOff: MatterbridgeEndpoint | undefined;
  dimmer: MatterbridgeEndpoint | undefined;
  light: MatterbridgeEndpoint | undefined;
  lightXY: MatterbridgeEndpoint | undefined;
  lightHS: MatterbridgeEndpoint | undefined;
  lightCT: MatterbridgeEndpoint | undefined;
  outlet: MatterbridgeEndpoint | undefined;
  coverLift: MatterbridgeEndpoint | undefined;
  coverLiftTilt: MatterbridgeEndpoint | undefined;
  lock: MatterbridgeEndpoint | undefined;
  thermoAuto: MatterbridgeEndpoint | undefined;
  thermoAutoOccupancy: MatterbridgeEndpoint | undefined;
  thermoHeat: MatterbridgeEndpoint | undefined;
  thermoCool: MatterbridgeEndpoint | undefined;
  fanBase: MatterbridgeEndpoint | undefined;
  fanOnHigh: MatterbridgeEndpoint | undefined;
  fanDefault: MatterbridgeEndpoint | undefined;
  fanComplete: MatterbridgeEndpoint | undefined;
  waterLeak: MatterbridgeEndpoint | undefined;
  waterFreeze: MatterbridgeEndpoint | undefined;
  rain: MatterbridgeEndpoint | undefined;
  smokeCo: MatterbridgeEndpoint | undefined;
  smokeOnly: MatterbridgeEndpoint | undefined;
  coOnly: MatterbridgeEndpoint | undefined;
  airQuality: MatterbridgeEndpoint | undefined;
  airPurifier: MatterbridgeEndpoint | undefined;
  pump: MatterbridgeEndpoint | undefined;
  valve: MatterbridgeEndpoint | undefined;
  momentarySwitch: MatterbridgeEndpoint | undefined;
  latchingSwitch: MatterbridgeEndpoint | undefined;
  vacuum: MatterbridgeEndpoint | undefined;
  roboticVacuum: MatterbridgeEndpoint | undefined;
  waterHeater: MatterbridgeEndpoint | undefined;
  evse: MatterbridgeEndpoint | undefined;
  laundryWasher: MatterbridgeEndpoint | undefined;
  laundryDryer: MatterbridgeEndpoint | undefined;
  dishwasher: MatterbridgeEndpoint | undefined;
  extractorHood: MatterbridgeEndpoint | undefined;
  solarPower: MatterbridgeEndpoint | undefined;
  batteryStorage: MatterbridgeEndpoint | undefined;
  heatPump: MatterbridgeEndpoint | undefined;
  microwaveOven: MatterbridgeEndpoint | undefined;
  oven: Oven | undefined;
  cooktop: Cooktop | undefined;
  refrigerator: Refrigerator | undefined;
  airConditioner: AirConditioner | undefined;
  speaker: Speaker | undefined;

  phaseInterval: NodeJS.Timeout | undefined;
  phase: number = -1;
  sensorInterval: NodeJS.Timeout | undefined;
  switchInterval: NodeJS.Timeout | undefined;
  lightInterval: NodeJS.Timeout | undefined;
  outletInterval: NodeJS.Timeout | undefined;
  coverInterval: NodeJS.Timeout | undefined;
  lockInterval: NodeJS.Timeout | undefined;
  thermoInterval: NodeJS.Timeout | undefined;
  fanInterval: NodeJS.Timeout | undefined;
  waterLeakInterval: NodeJS.Timeout | undefined;
  waterFreezeInterval: NodeJS.Timeout | undefined;
  rainInterval: NodeJS.Timeout | undefined;
  smokeInterval: NodeJS.Timeout | undefined;
  airQualityInterval: NodeJS.Timeout | undefined;
  airConditionerInterval: NodeJS.Timeout | undefined;
  genericSwitchInterval: NodeJS.Timeout | undefined;
  genericSwitchLastEvent: 'Single' | 'Double' | 'Long' | 'Press' | 'Release' = 'Release';

  intervalOnOff = false;
  intervalLevel = 1;
  intervalColorTemperature = 147;

  bridgedDevices = new Map<string, MatterbridgeEndpoint>();

  fanModeLookup = ['Off', 'Low', 'Medium', 'High', 'On', 'Auto', 'Smart'];
  fanDirectionLookup = ['Forward', 'Reverse'];

  constructor(
    matterbridge: PlatformMatterbridge,
    log: AnsiLogger,
    override config: DynamicPlatformConfig,
  ) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.4.0')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.4.0". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }

    this.log.info('Initializing platform:', this.config.name);
  }

  override async onStart(reason?: string) {
    this.log.info('onStart called with reason:', reason ?? 'none');

    // Wait for the platform to start
    await this.ready;
    await this.clearSelect();

    // *********************** Create a door device ***********************
    this.door = new MatterbridgeEndpoint([contactSensor, bridgedNode, powerSource], { id: 'Door' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Door', 'DOO00001', 0xfff1, 'Matterbridge', 'Matterbridge Door')
      .createDefaultBooleanStateClusterServer(true)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(90, PowerSource.BatChargeLevel.Ok, 2990, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.door = await this.addDevice(this.door);

    // *********************** Create an occupancy device ***********************
    this.occupancy = new MatterbridgeEndpoint([occupancySensor, bridgedNode, powerSource], { id: 'Occupancy' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Occupancy', 'OCC00002', 0xfff1, 'Matterbridge', 'Matterbridge Occupancy')
      .createDefaultOccupancySensingClusterServer(false)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(70, PowerSource.BatChargeLevel.Ok, 2950, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.occupancy = await this.addDevice(this.occupancy);

    // *********************** Create an illuminance device ***********************
    this.illuminance = new MatterbridgeEndpoint([lightSensor, bridgedNode, powerSource], { id: 'Illuminance' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Illuminance', 'ILL00003', 0xfff1, 'Matterbridge', 'Matterbridge Illuminance')
      .createDefaultIlluminanceMeasurementClusterServer(luxToMatter(1))
      .createDefaultPowerSourceReplaceableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 3100, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.illuminance = await this.addDevice(this.illuminance);

    // *********************** Create an temperature device ***********************
    this.temperature = new MatterbridgeEndpoint([temperatureSensor, bridgedNode, powerSource], { id: 'Temperature' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Temperature', 'TEM00004', 0xfff1, 'Matterbridge', 'Matterbridge Temperature')
      .createDefaultTemperatureMeasurementClusterServer(1000)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 3100, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.temperature = await this.addDevice(this.temperature);

    // *********************** Create an humidity device ***********************
    this.humidity = new MatterbridgeEndpoint([humiditySensor, bridgedNode, powerSource], { id: 'Humidity' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Humidity', 'HUM00005', 0xfff1, 'Matterbridge', 'Matterbridge Humidity')
      .createDefaultRelativeHumidityMeasurementClusterServer(1000)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 3100, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.humidity = await this.addDevice(this.humidity);

    // *********************** Create a pressure device ***********************
    this.pressure = new MatterbridgeEndpoint([pressureSensor, bridgedNode, powerSource], { id: 'Pressure' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Pressure', 'PRE00006', 0xfff1, 'Matterbridge', 'Matterbridge Pressure')
      .createDefaultPressureMeasurementClusterServer(9000)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 3050, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.pressure = await this.addDevice(this.pressure);

    // *********************** Create a flow device ***********************
    this.flow = new MatterbridgeEndpoint([flowSensor, bridgedNode, powerSource], { id: 'Flow' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Flow', 'FLO00007', 0xfff1, 'Matterbridge', 'Matterbridge Flow')
      .createDefaultFlowMeasurementClusterServer(10)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(80, PowerSource.BatChargeLevel.Ok, 3050, 'AA', 1, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.flow = await this.addDevice(this.flow);

    // *********************** Create a climate device ***********************
    this.climate = new MatterbridgeEndpoint([temperatureSensor, humiditySensor, pressureSensor, bridgedNode, powerSource], { id: 'Climate' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Climate', 'CLI00008', 0xfff1, 'Matterbridge', 'Matterbridge Climate')
      .createDefaultTemperatureMeasurementClusterServer(1000)
      .createDefaultRelativeHumidityMeasurementClusterServer(1000)
      .createDefaultPressureMeasurementClusterServer(9000)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(90, PowerSource.BatChargeLevel.Ok, 2990, '2 x AA', 2, PowerSource.BatReplaceability.UserReplaceable)
      .addRequiredClusterServers();

    this.climate = await this.addDevice(this.climate);

    // *********************** Create a select device ***********************
    this.select = new MatterbridgeEndpoint([modeSelect, bridgedNode, powerSource], { id: 'Select' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Select', 'SEL00009', 0xfff1, 'Matterbridge', 'Matterbridge Select')
      .createDefaultModeSelectClusterServer(
        'Night mode',
        [
          { label: 'Led ON', mode: 1, semanticTags: [] },
          { label: 'Led OFF', mode: 2, semanticTags: [] },
        ],
        1,
        1,
      )
      .createDefaultPowerSourceWiredClusterServer()
      .addRequiredClusterServers();

    this.select = await this.addDevice(this.select);

    this.select?.addCommandHandler('changeToMode', async ({ request: { newMode } }) => {
      this.log.info(`Command changeToMode called newMode:${newMode}`);
    });

    // *********************** Create a switch device ***********************
    this.switch = new MatterbridgeEndpoint([onOffSwitch, bridgedNode, powerSource], { id: 'Switch' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Switch', 'SWI00010', 0xfff1, 'Matterbridge', 'Matterbridge Switch')
      .createDefaultOnOffClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.switch = await this.addDevice(this.switch);

    // The cluster attributes are set by MatterbridgeOnOffServer
    this.switch?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.switch?.addCommandHandler('on', async () => {
      this.switch?.log.info('Command on called');
    });
    this.switch?.addCommandHandler('off', async () => {
      this.switch?.log.info('Command off called');
    });

    // *********************** Create a mounted onOff switch device ***********************
    this.mountedOnOffSwitch = new MatterbridgeEndpoint([onOffMountedSwitch, bridgedNode, powerSource], { id: 'OnOffMountedSwitch' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('OnOff Mounted Switch', 'OMS00011', 0xfff1, 'Matterbridge', 'Matterbridge OnOff Mounted Switch')
      .createDefaultOnOffClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.mountedOnOffSwitch = await this.addDevice(this.mountedOnOffSwitch);

    // The cluster attributes are set by MatterbridgeOnOffServer
    this.mountedOnOffSwitch?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.mountedOnOffSwitch?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.mountedOnOffSwitch?.addCommandHandler('on', async () => {
      this.mountedOnOffSwitch?.log.info('Command on called');
    });
    this.mountedOnOffSwitch?.addCommandHandler('off', async () => {
      this.mountedOnOffSwitch?.log.info('Command off called');
    });

    // *********************** Create a mounted dimmer switch device ***********************
    this.mountedDimmerSwitch = new MatterbridgeEndpoint([dimmableMountedSwitch, bridgedNode, powerSource], { id: 'DimmerMountedSwitch' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Dimmer Mounted Switch', 'DMS00012', 0xfff1, 'Matterbridge', 'Matterbridge Dimmer Mounted Switch')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer()
      .addRequiredClusterServers();

    this.mountedDimmerSwitch = await this.addDevice(this.mountedDimmerSwitch);

    // The cluster attributes are set by MatterbridgeOnOffServer and MatterbridgeLevelControlServer
    this.mountedDimmerSwitch?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.mountedDimmerSwitch?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.mountedDimmerSwitch?.addCommandHandler('on', async () => {
      this.mountedDimmerSwitch?.log.info('Command on called');
    });
    this.mountedDimmerSwitch?.addCommandHandler('off', async () => {
      this.mountedDimmerSwitch?.log.info('Command off called');
    });
    this.mountedDimmerSwitch?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.mountedDimmerSwitch?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.mountedDimmerSwitch?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.mountedDimmerSwitch?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });

    // *********************** Create a on off light device ***********************
    this.lightOnOff = new MatterbridgeEndpoint([onOffLight, bridgedNode, powerSource], { id: 'Light (on/off)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light (on/off)', 'LON00013', 0xfff1, 'Matterbridge', 'Matterbridge Light on/off')
      .createDefaultOnOffClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.lightOnOff = await this.addDevice(this.lightOnOff);

    // The cluster attributes are set by MatterbridgeOnOffServer
    this.lightOnOff?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.lightOnOff?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.lightOnOff?.addCommandHandler('on', async () => {
      this.lightOnOff?.log.info('Command on called');
    });
    this.lightOnOff?.addCommandHandler('off', async () => {
      this.lightOnOff?.log.info('Command off called');
    });

    // *********************** Create a dimmer device ***********************
    this.dimmer = new MatterbridgeEndpoint([dimmableLight, bridgedNode, powerSource], { id: 'Dimmer' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Dimmer', 'DMR00014', 0xfff1, 'Matterbridge', 'Matterbridge Dimmer')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.dimmer = await this.addDevice(this.dimmer);

    // The cluster attributes are set by MatterbridgeOnOffServer and MatterbridgeLevelControlServer
    this.dimmer?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.dimmer?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.dimmer?.addCommandHandler('on', async () => {
      this.dimmer?.log.info('Command on called');
    });
    this.dimmer?.addCommandHandler('off', async () => {
      this.dimmer?.log.info('Command off called');
    });
    this.dimmer?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.dimmer?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.dimmer?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.dimmer?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });

    // *********************** Create a light device with XY, HS and CT color control ***********************
    this.light = new MatterbridgeEndpoint([extendedColorLight, bridgedNode, powerSource], { id: 'Light (XY, HS, CT)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light (XY, HS, CT)', 'LXC00015', 0xfff1, 'Matterbridge', 'Matterbridge Light')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createDefaultColorControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.light = await this.addDevice(this.light);

    // The cluster attributes are set by MatterbridgeOnOffServer, MatterbridgeLevelControlServer and MatterbridgeColorControlServer
    this.light?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.light?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.light?.addCommandHandler('on', async () => {
      this.light?.log.info('Command on called');
    });
    this.light?.addCommandHandler('off', async () => {
      this.light?.log.info('Command off called');
    });
    this.light?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.light?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.light?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.light?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });
    this.light?.addCommandHandler('moveToColor', async ({ request: { colorX, colorY } }) => {
      this.light?.log.debug(`Command moveToColor called request: X ${colorX / 65536} Y ${colorY / 65536}`);
    });
    this.light?.addCommandHandler('moveToHueAndSaturation', async ({ request: { hue, saturation } }) => {
      this.light?.log.debug(`Command moveToHueAndSaturation called request: hue ${hue} saturation ${saturation}`);
    });
    this.light?.addCommandHandler('moveToHue', async ({ request: { hue } }) => {
      this.light?.log.debug(`Command moveToHue called request: hue ${hue}`);
    });
    this.light?.addCommandHandler('moveToSaturation', async ({ request: { saturation } }) => {
      this.light?.log.debug(`Command moveToSaturation called request: saturation ${saturation}}`);
    });
    this.light?.addCommandHandler('moveToColorTemperature', async ({ request: { colorTemperatureMireds } }) => {
      this.light?.log.debug(`Command moveToColorTemperature called request: ${colorTemperatureMireds}`);
    });

    // *********************** Create a light device with HS and CT color control ***********************
    this.lightHS = new MatterbridgeEndpoint([colorTemperatureLight, bridgedNode, powerSource], { id: 'Light (HS, CT)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light (HS, CT)', 'LHC00016', 0xfff1, 'Matterbridge', 'Matterbridge Light')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createHsColorControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.lightHS = await this.addDevice(this.lightHS);

    // The cluster attributes are set by MatterbridgeOnOffServer, MatterbridgeLevelControlServer and MatterbridgeColorControlServer
    this.lightHS?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.lightHS?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.lightHS?.addCommandHandler('on', async () => {
      this.lightHS?.log.info('Command on called');
    });
    this.lightHS?.addCommandHandler('off', async () => {
      this.lightHS?.log.info('Command off called');
    });
    this.lightHS?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.lightHS?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.lightHS?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.lightHS?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });
    this.lightHS?.addCommandHandler('moveToHueAndSaturation', async ({ request: { hue, saturation } }) => {
      this.lightHS?.log.debug(`Command moveToHueAndSaturation called request: hue ${hue} saturation ${saturation}}`);
    });
    this.lightHS?.addCommandHandler('moveToHue', async ({ request: { hue } }) => {
      this.lightHS?.log.debug(`Command moveToHue called request: hue ${hue}`);
    });
    this.lightHS?.addCommandHandler('moveToSaturation', async ({ request: { saturation } }) => {
      this.lightHS?.log.debug(`Command moveToSaturation called request: saturation ${saturation}`);
    });
    this.lightHS?.addCommandHandler('moveToColorTemperature', async ({ request: { colorTemperatureMireds } }) => {
      this.lightHS?.log.debug(`Command moveToColorTemperature called request: ${colorTemperatureMireds}`);
    });

    // *********************** Create a light device with XY and CT color control ***********************
    this.lightXY = new MatterbridgeEndpoint([extendedColorLight, bridgedNode, powerSource], { id: 'Light (XY, CT)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light (XY, CT)', 'LXT00017', 0xfff1, 'Matterbridge', 'Matterbridge Light')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createXyColorControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.lightXY = await this.addDevice(this.lightXY);

    // The cluster attributes are set by MatterbridgeOnOffServer, MatterbridgeLevelControlServer and MatterbridgeColorControlServer
    this.lightXY?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.lightXY?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.lightXY?.addCommandHandler('on', async () => {
      this.lightXY?.log.info('Command on called');
    });
    this.lightXY?.addCommandHandler('off', async () => {
      this.lightXY?.log.info('Command off called');
    });
    this.lightXY?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.lightXY?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.lightXY?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.lightXY?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });
    this.lightXY?.addCommandHandler('moveToColor', async ({ request: { colorX, colorY } }) => {
      this.lightXY?.log.debug(`Command moveToColor called request: X ${colorX / 65536} Y ${colorY / 65536}`);
    });
    this.lightXY?.addCommandHandler('moveToColorTemperature', async ({ request: { colorTemperatureMireds } }) => {
      this.lightXY?.log.debug(`Command moveToColorTemperature called request: ${colorTemperatureMireds}`);
    });

    // *********************** Create a light device with CT color control ***********************
    this.lightCT = new MatterbridgeEndpoint([colorTemperatureLight, bridgedNode, powerSource], { id: 'Light (CT)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Light (CT)', 'LCT00018', 0xfff1, 'Matterbridge', 'Matterbridge Light')
      .createDefaultOnOffClusterServer()
      .createDefaultLevelControlClusterServer()
      .createCtColorControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.lightCT = await this.addDevice(this.lightCT);

    // The cluster attributes are set by MatterbridgeOnOffServer, MatterbridgeLevelControlServer and MatterbridgeColorControlServer
    this.lightCT?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.lightCT?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.lightCT?.addCommandHandler('on', async () => {
      this.lightCT?.log.info('Command on called');
    });
    this.lightCT?.addCommandHandler('off', async () => {
      this.lightCT?.log.info('Command off called');
    });
    this.lightCT?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.lightCT?.log.debug(`Command moveToLevel called request: ${level}`);
    });
    this.lightCT?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.lightCT?.log.debug(`Command moveToLevelWithOnOff called request: ${level}`);
    });
    this.lightCT?.addCommandHandler('moveToColorTemperature', async ({ request: { colorTemperatureMireds } }) => {
      this.lightCT?.log.debug(`Command moveToColorTemperature called request: ${colorTemperatureMireds}`);
    });

    // *********************** Create an outlet device ***********************
    this.outlet = new MatterbridgeEndpoint([onOffOutlet, bridgedNode, powerSource], { id: 'Outlet' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Outlet', 'OUT00019', 0xfff1, 'Matterbridge', 'Matterbridge Outlet')
      .createDefaultOnOffClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.outlet = await this.addDevice(this.outlet);

    // The cluster attributes are set by MatterbridgeOnOffServer
    this.outlet?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.outlet?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.outlet?.addCommandHandler('on', async () => {
      this.outlet?.log.info('Command on called');
    });
    this.outlet?.addCommandHandler('off', async () => {
      this.outlet?.log.info('Command off called');
    });

    // *********************** Create a window covering device ***********************
    // Matter uses 10000 = fully closed   0 = fully opened
    this.coverLift = new MatterbridgeEndpoint([coverDevice, bridgedNode, powerSource], { id: 'CoverLift' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Cover lift', 'COV00020', 0xfff1, 'Matterbridge', 'Matterbridge Cover')
      .createDefaultWindowCoveringClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.coverLift = await this.addDevice(this.coverLift);

    // The cluster attributes are set by MatterbridgeLiftWindowCoveringServer.  The implementation shall handle the movement (i.e. the currentPosition).
    this.coverLift?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.coverLift?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });

    this.coverLift?.addCommandHandler('stopMotion', async () => {
      await this.coverLift?.setWindowCoveringTargetAsCurrentAndStopped();
      this.coverLift?.log.info(`Command stopMotion called`);
    });

    this.coverLift?.addCommandHandler('downOrClose', async () => {
      await this.coverLift?.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped);
      this.coverLift?.log.info(`Command downOrClose called`);
    });

    this.coverLift?.addCommandHandler('upOrOpen', async () => {
      await this.coverLift?.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped);
      this.coverLift?.log.info(`Command upOrOpen called`);
    });

    this.coverLift?.addCommandHandler('goToLiftPercentage', async ({ request: { liftPercent100thsValue } }) => {
      await this.coverLift?.setWindowCoveringCurrentTargetStatus(liftPercent100thsValue, liftPercent100thsValue, WindowCovering.MovementStatus.Stopped);
      this.coverLift?.log.info(`Command goToLiftPercentage ${liftPercent100thsValue} called`);
    });

    // *********************** Create a tilt window covering device ***********************
    // Matter uses 10000 = fully closed   0 = fully opened
    this.coverLiftTilt = new MatterbridgeEndpoint([coverDevice, bridgedNode, powerSource], { id: 'CoverLiftTilt' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Cover lift and tilt', 'CLT00021', 0xfff1, 'Matterbridge', 'Matterbridge Cover')
      .createDefaultLiftTiltWindowCoveringClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.coverLiftTilt = await this.addDevice(this.coverLiftTilt);

    // The cluster attributes are set by MatterbridgeLiftTiltWindowCoveringServer. The implementation shall handle the movement (i.e. the currentPosition).
    this.coverLiftTilt?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.coverLiftTilt?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });

    this.coverLiftTilt?.addCommandHandler('stopMotion', async () => {
      await this.coverLiftTilt?.setWindowCoveringTargetAsCurrentAndStopped();
      this.coverLiftTilt?.log.info(`Command stopMotion called`);
    });

    this.coverLiftTilt?.addCommandHandler('downOrClose', async () => {
      await this.coverLiftTilt?.setWindowCoveringCurrentTargetStatus(10000, 10000, WindowCovering.MovementStatus.Stopped);
      this.coverLiftTilt?.log.info(`Command downOrClose called`);
    });

    this.coverLiftTilt?.addCommandHandler('upOrOpen', async () => {
      await this.coverLiftTilt?.setWindowCoveringCurrentTargetStatus(0, 0, WindowCovering.MovementStatus.Stopped);
      this.coverLiftTilt?.log.info(`Command upOrOpen called`);
    });

    this.coverLiftTilt?.addCommandHandler('goToLiftPercentage', async ({ request: { liftPercent100thsValue } }) => {
      await this.coverLiftTilt?.setWindowCoveringCurrentTargetStatus(liftPercent100thsValue, liftPercent100thsValue, WindowCovering.MovementStatus.Stopped);
      this.coverLiftTilt?.log.info(`Command goToLiftPercentage ${liftPercent100thsValue} called`);
    });

    this.coverLiftTilt?.addCommandHandler('goToTiltPercentage', async ({ request: { tiltPercent100thsValue } }) => {
      const position = this.coverLiftTilt?.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', this.coverLiftTilt?.log);
      await this.coverLiftTilt?.setWindowCoveringTargetAndCurrentPosition(position, tiltPercent100thsValue);
      this.coverLiftTilt?.log.info(`Command goToTiltPercentage ${tiltPercent100thsValue} called`);
    });

    // *********************** Create a lock device ***********************
    this.lock = new MatterbridgeEndpoint([doorLockDevice, bridgedNode, powerSource], { id: 'Lock' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Lock', 'LOC00022', 0xfff1, 'Matterbridge', 'Matterbridge Lock')
      .createDefaultDoorLockClusterServer()
      .createDefaultPowerSourceRechargeableBatteryClusterServer(30);

    this.lock = await this.addDevice(this.lock);

    // The cluster attributes are set by MatterbridgeDoorLockServer
    this.lock?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.lock?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.lock?.addCommandHandler('lockDoor', async () => {
      this.lock?.log.info('Command lockDoor called');
    });
    this.lock?.addCommandHandler('unlockDoor', async () => {
      this.lock?.log.info('Command unlockDoor called');
    });
    await this.lock?.subscribeAttribute(
      DoorLock.Cluster.id,
      'operatingMode',
      (value) => {
        const lookupOperatingMode = ['Normal', 'Vacation', 'Privacy', 'NoRemoteLockUnlock', 'Passage'];
        this.lock?.log.info('Subscribe operatingMode called with:', lookupOperatingMode[value]);
      },
      this.lock.log,
    );

    // *********************** Create a thermostat with AutoMode device ***********************
    this.thermoAuto = new MatterbridgeEndpoint([thermostatDevice, bridgedNode, powerSource], { id: 'Thermostat (AutoMode)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Thermostat (Auto)', 'TAU00023', 0xfff1, 'Matterbridge', 'Matterbridge Thermostat')
      .createDefaultThermostatClusterServer(20, 18, 22)
      .createDefaultPowerSourceRechargeableBatteryClusterServer(70, PowerSource.BatChargeLevel.Ok, 4700);

    this.thermoAuto
      .addChildDeviceType('Flow', flowSensor)
      .createDefaultFlowMeasurementClusterServer(1 * 10)
      .addRequiredClusterServers();

    this.thermoAuto
      .addChildDeviceType('Temperature', temperatureSensor)
      .createDefaultTemperatureMeasurementClusterServer(21 * 100)
      .addRequiredClusterServers();

    this.thermoAuto
      .addChildDeviceType('Humidity', humiditySensor)
      .createDefaultRelativeHumidityMeasurementClusterServer(50 * 100)
      .addRequiredClusterServers();

    this.thermoAuto = await this.addDevice(this.thermoAuto);

    // The cluster attributes are set by MatterbridgeThermostatServer
    this.thermoAuto?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.thermoAuto?.log.info(`Command identify called identifyTime ${identifyTime}`);
    });
    this.thermoAuto?.addCommandHandler('triggerEffect', async ({ request: { effectIdentifier, effectVariant } }) => {
      this.thermoAuto?.log.info(`Command identify called effectIdentifier ${effectIdentifier} effectVariant ${effectVariant}`);
    });
    this.thermoAuto?.addCommandHandler('setpointRaiseLower', async ({ request: { mode, amount } }) => {
      const lookupSetpointAdjustMode = ['Heat', 'Cool', 'Both'];
      this.thermoAuto?.log.info(`Command setpointRaiseLower called with mode: ${lookupSetpointAdjustMode[mode]} amount: ${amount / 10}`);
    });
    await this.thermoAuto?.subscribeAttribute(
      ThermostatCluster.id,
      'systemMode',
      (value) => {
        const lookupSystemMode = ['Off', 'Auto', '', 'Cool', 'Heat', 'EmergencyHeat', 'Precooling', 'FanOnly', 'Dry', 'Sleep'];
        this.thermoAuto?.log.info('Subscribe systemMode called with:', lookupSystemMode[value]);
      },
      this.thermoAuto.log,
    );
    await this.thermoAuto?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedHeatingSetpoint',
      (value) => {
        this.thermoAuto?.log.info('Subscribe occupiedHeatingSetpoint called with:', value / 100);
      },
      this.thermoAuto.log,
    );
    await this.thermoAuto?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedCoolingSetpoint',
      (value) => {
        this.thermoAuto?.log.info('Subscribe occupiedCoolingSetpoint called with:', value / 100);
      },
      this.thermoAuto.log,
    );

    // *********************** Create a thermostat with AutoMode and Occupancy device ***********************
    this.thermoAutoOccupancy = new MatterbridgeEndpoint([thermostatDevice, bridgedNode, powerSource], { id: 'Thermostat (AutoModeOccupancy)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Thermostat (AutoOccupancy)', 'TAO00058', 0xfff1, 'Matterbridge', 'Matterbridge Thermostat')
      .createDefaultThermostatClusterServer(20, 18, 22, 1, 0, 35, 15, 50, 10, 30, false, 20.5)
      .createDefaultPowerSourceWiredClusterServer();

    this.thermoAutoOccupancy = await this.addDevice(this.thermoAutoOccupancy);

    await this.thermoAutoOccupancy?.subscribeAttribute(
      ThermostatCluster.id,
      'systemMode',
      (value) => {
        const lookupSystemMode = ['Off', 'Auto', '', 'Cool', 'Heat', 'EmergencyHeat', 'Precooling', 'FanOnly', 'Dry', 'Sleep'];
        this.thermoAutoOccupancy?.log.info('Subscribe systemMode called with:', lookupSystemMode[value]);
      },
      this.thermoAutoOccupancy.log,
    );
    await this.thermoAutoOccupancy?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedHeatingSetpoint',
      (value) => {
        this.thermoAutoOccupancy?.log.info('Subscribe occupiedHeatingSetpoint called with:', value / 100);
      },
      this.thermoAutoOccupancy.log,
    );
    await this.thermoAutoOccupancy?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedCoolingSetpoint',
      (value) => {
        this.thermoAutoOccupancy?.log.info('Subscribe occupiedCoolingSetpoint called with:', value / 100);
      },
      this.thermoAutoOccupancy.log,
    );
    await this.thermoAutoOccupancy?.subscribeAttribute(
      ThermostatCluster.id,
      'unoccupiedHeatingSetpoint',
      (value) => {
        this.thermoAutoOccupancy?.log.info('Subscribe unoccupiedHeatingSetpoint called with:', value / 100);
      },
      this.thermoAutoOccupancy.log,
    );
    await this.thermoAutoOccupancy?.subscribeAttribute(
      ThermostatCluster.id,
      'unoccupiedCoolingSetpoint',
      (value) => {
        this.thermoAutoOccupancy?.log.info('Subscribe unoccupiedCoolingSetpoint called with:', value / 100);
      },
      this.thermoAutoOccupancy.log,
    );

    // *********************** Create a thermostat with Heat device ***********************
    this.thermoHeat = new MatterbridgeEndpoint([thermostatDevice, bridgedNode, powerSource], { id: 'Thermostat (Heat)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Thermostat (Heat)', 'THE00024', 0xfff1, 'Matterbridge', 'Matterbridge Thermostat')
      .createDefaultHeatingThermostatClusterServer(20, 18, 5, 35)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(70, PowerSource.BatChargeLevel.Ok, 6010, 'AA 1.5V', 4);

    this.thermoHeat
      .addChildDeviceType('TemperatureIN', [temperatureSensor], {
        tagList: [
          { mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null },
          { mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag: NumberTag.One.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultTemperatureMeasurementClusterServer(21 * 100);

    this.thermoHeat
      .addChildDeviceType('TemperatureOUT', [temperatureSensor], {
        tagList: [
          { mfgCode: null, namespaceId: LocationTag.Outdoor.namespaceId, tag: LocationTag.Outdoor.tag, label: null },
          { mfgCode: null, namespaceId: NumberTag.Two.namespaceId, tag: NumberTag.Two.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultTemperatureMeasurementClusterServer(15 * 100);

    this.thermoHeat = await this.addDevice(this.thermoHeat);

    // The cluster attributes are set by MatterbridgeThermostatServer
    this.thermoHeat?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.thermoHeat?.log.info(`Command identify called identifyTime ${identifyTime}`);
    });
    this.thermoHeat?.addCommandHandler('triggerEffect', async ({ request: { effectIdentifier, effectVariant } }) => {
      this.thermoHeat?.log.info(`Command identify called effectIdentifier ${effectIdentifier} effectVariant ${effectVariant}`);
    });
    await this.thermoHeat?.subscribeAttribute(
      ThermostatCluster.id,
      'systemMode',
      (value) => {
        const lookupSystemMode = ['Off', 'Auto', '', 'Cool', 'Heat', 'EmergencyHeat', 'Precooling', 'FanOnly', 'Dry', 'Sleep'];
        this.thermoHeat?.log.info('Subscribe systemMode called with:', lookupSystemMode[value]);
      },
      this.thermoHeat.log,
    );
    await this.thermoHeat?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedHeatingSetpoint',
      (value) => {
        this.thermoHeat?.log.info('Subscribe occupiedHeatingSetpoint called with:', value / 100);
      },
      this.thermoHeat.log,
    );

    // *********************** Create a thermostat with Cool device ***********************
    this.thermoCool = new MatterbridgeEndpoint([thermostatDevice, bridgedNode, powerSource], { id: 'Thermostat (Cool)' }, this.config.debug)
      .createDefaultIdentifyClusterServer()
      .createDefaultGroupsClusterServer()
      .createDefaultBridgedDeviceBasicInformationClusterServer('Thermostat (Cool)', 'TCO00025', 0xfff1, 'Matterbridge', 'Matterbridge Thermostat')
      .createDefaultCoolingThermostatClusterServer(20, 18, 5, 35)
      .createDefaultPowerSourceReplaceableBatteryClusterServer(40, PowerSource.BatChargeLevel.Ok, 5080, 'AA 1.5V', 4);

    this.thermoCool = await this.addDevice(this.thermoCool);

    // The cluster attributes are set by MatterbridgeThermostatServer
    this.thermoCool?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.thermoCool?.log.info(`Command identify called identifyTime ${identifyTime}`);
    });
    this.thermoCool?.addCommandHandler('triggerEffect', async ({ request: { effectIdentifier, effectVariant } }) => {
      this.thermoCool?.log.info(`Command identify called effectIdentifier ${effectIdentifier} effectVariant ${effectVariant}`);
    });
    await this.thermoCool?.subscribeAttribute(
      ThermostatCluster.id,
      'systemMode',
      (value) => {
        const lookupSystemMode = ['Off', 'Auto', '', 'Cool', 'Heat', 'EmergencyHeat', 'Precooling', 'FanOnly', 'Dry', 'Sleep'];
        this.thermoCool?.log.info('Subscribe systemMode called with:', lookupSystemMode[value]);
      },
      this.thermoCool.log,
    );
    await this.thermoCool?.subscribeAttribute(
      ThermostatCluster.id,
      'occupiedCoolingSetpoint',
      (value) => {
        this.thermoCool?.log.info('Subscribe occupiedCoolingSetpoint called with:', value / 100);
      },
      this.thermoCool.log,
    );

    // *********************** Create a airPurifier device ***********************
    this.airPurifier = new MatterbridgeEndpoint([airPurifier, temperatureSensor, humiditySensor, bridgedNode, powerSource], { id: 'Air purifier' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Air purifier', 'AIR00026', 0xfff1, 'Matterbridge', 'Matterbridge Air purifier')
      .createDefaultIdentifyClusterServer()
      .createDefaultFanControlClusterServer()
      .createDefaultTemperatureMeasurementClusterServer(20 * 100)
      .createDefaultRelativeHumidityMeasurementClusterServer(50 * 100)
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultActivatedCarbonFilterMonitoringClusterServer()
      .createDefaultHepaFilterMonitoringClusterServer();

    this.airPurifier = await this.addDevice(this.airPurifier);

    this.airPurifier?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.airPurifier?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    // Apple sends Off, High and Auto
    await this.airPurifier?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.airPurifier?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.airPurifier?.log);
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.airPurifier?.log);
        } else if (newValue === FanControl.FanMode.Low) {
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentSetting', 33, this.airPurifier?.log);
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 33, this.airPurifier?.log);
        } else if (newValue === FanControl.FanMode.Medium) {
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentSetting', 66, this.airPurifier?.log);
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 66, this.airPurifier?.log);
        } else if (newValue === FanControl.FanMode.High || newValue === FanControl.FanMode.On || newValue === FanControl.FanMode.Auto) {
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.airPurifier?.log);
          this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.airPurifier?.log);
        }
      },
      this.airPurifier.log,
    );
    await this.airPurifier?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.airPurifier?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) this.airPurifier?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.airPurifier?.log);
      },
      this.airPurifier.log,
    );

    // *********************** Create a pumpDevice device ***********************
    this.pump = new MatterbridgeEndpoint([pumpDevice, bridgedNode, powerSource], { id: 'Pump' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Pump', 'PUM00028', 0xfff1, 'Matterbridge', 'Matterbridge Pump')
      .createDefaultIdentifyClusterServer()
      .createOnOffClusterServer()
      .createLevelControlClusterServer()
      .createDefaultPumpConfigurationAndControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.pump = await this.addDevice(this.pump);

    this.pump?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.pump?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    this.pump?.addCommandHandler('on', async () => {
      this.pump?.log.info('Command on called');
    });
    this.pump?.addCommandHandler('off', async () => {
      this.pump?.log.info('Command off called');
    });
    this.pump?.addCommandHandler('moveToLevel', async ({ request: { level } }) => {
      this.pump?.log.info(`Command moveToLevel called request: ${level}`);
    });
    this.pump?.addCommandHandler('moveToLevelWithOnOff', async ({ request: { level } }) => {
      this.pump?.log.info(`Command moveToLevelWithOnOff called request: ${level}`);
    });

    // *********************** Create a waterValve device ***********************
    this.valve = new MatterbridgeEndpoint([waterValve, bridgedNode, powerSource], { id: 'Water valve' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Water valve', 'WAV00029', 0xfff1, 'Matterbridge', 'Matterbridge Water valve')
      .createDefaultIdentifyClusterServer()
      .createDefaultValveConfigurationAndControlClusterServer()
      .createDefaultPowerSourceWiredClusterServer();

    this.valve = await this.addDevice(this.valve);

    this.valve?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.valve?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });

    // *********************** Create a default off low medium high auto fan device ***********************
    this.fanDefault = new MatterbridgeEndpoint([fanDevice, bridgedNode, powerSource], { id: 'Fan off low medium high auto' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Fan', 'FAN00030', 0xfff1, 'Matterbridge', 'Matterbridge Fan')
      .createDefaultPowerSourceWiredClusterServer()
      .createDefaultFanControlClusterServer()
      .addRequiredClusterServers();

    this.fanDefault = await this.addDevice(this.fanDefault);

    await this.fanDefault?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.fanDefault?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanDefault?.log);
        } else if (newValue === FanControl.FanMode.Low) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 33, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 33, this.fanDefault?.log);
        } else if (newValue === FanControl.FanMode.Medium) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 66, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 66, this.fanDefault?.log);
        } else if (newValue === FanControl.FanMode.High) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanDefault?.log);
        } else if (newValue === FanControl.FanMode.On) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanDefault?.log);
        } else if (newValue === FanControl.FanMode.Auto) {
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 50, this.fanDefault?.log);
          this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 50, this.fanDefault?.log);
        }
      },
      this.fanDefault.log,
    );
    await this.fanDefault?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.fanDefault?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.fanDefault?.log);
      },
      this.fanDefault.log,
    );

    // *********************** Create a base fan device ***********************
    this.fanBase = new MatterbridgeEndpoint([fanDevice, bridgedNode, powerSource], { id: 'Fan off low medium high' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Fan base', 'FBA00031', 0xfff1, 'Matterbridge', 'Matterbridge Fan')
      .createDefaultPowerSourceWiredClusterServer()
      .createBaseFanControlClusterServer()
      .addRequiredClusterServers();

    this.fanBase = await this.addDevice(this.fanBase);

    await this.fanBase?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.fanBase?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanBase?.log);
        } else if (newValue === FanControl.FanMode.Low) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 33, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 33, this.fanBase?.log);
        } else if (newValue === FanControl.FanMode.Medium) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 66, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 66, this.fanBase?.log);
        } else if (newValue === FanControl.FanMode.High) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanBase?.log);
        } else if (newValue === FanControl.FanMode.On) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanBase?.log);
        } else if (newValue === FanControl.FanMode.Auto) {
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 50, this.fanBase?.log);
          this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 50, this.fanBase?.log);
        }
      },
      this.fanBase.log,
    );
    await this.fanBase?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.fanBase?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.fanBase?.log);
      },
      this.fanBase.log,
    );

    // *********************** Create a On High fan device ***********************
    this.fanOnHigh = new MatterbridgeEndpoint([fanDevice, bridgedNode, powerSource], { id: 'Fan off high' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Fan off high', 'FOH00032', 0xfff1, 'Matterbridge', 'Matterbridge Fan')
      .createDefaultPowerSourceWiredClusterServer()
      .createOnOffFanControlClusterServer()
      .addRequiredClusterServers();

    this.fanOnHigh = await this.addDevice(this.fanOnHigh);

    await this.fanOnHigh?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.fanOnHigh?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanOnHigh?.log);
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanOnHigh?.log);
        } else if (newValue === FanControl.FanMode.High) {
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanOnHigh?.log);
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanOnHigh?.log);
        }
      },
      this.fanOnHigh.log,
    );
    await this.fanOnHigh?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.fanOnHigh?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) {
          if (newValue > 0) newValue = 100; // OnOff fan control only supports 0 and 100
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.fanOnHigh?.log);
          this.fanOnHigh?.setAttribute(FanControl.Cluster.id, 'percentSetting', newValue, this.fanOnHigh?.log);
        }
      },
      this.fanOnHigh.log,
    );

    // ******************** Create a complete fan device ********************
    this.fanComplete = new MatterbridgeEndpoint([fanDevice, bridgedNode, powerSource], { id: 'Fan complete' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Fan complete', 'FCO00033', 0xfff1, 'Matterbridge', 'Matterbridge Fan')
      .createDefaultPowerSourceWiredClusterServer()
      .createCompleteFanControlClusterServer()
      .addRequiredClusterServers();

    this.fanComplete = await this.addDevice(this.fanComplete);

    await this.fanComplete?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.fanComplete?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanComplete?.log);
        } else if (newValue === FanControl.FanMode.Low) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 33, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 33, this.fanComplete?.log);
        } else if (newValue === FanControl.FanMode.Medium) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 66, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 66, this.fanComplete?.log);
        } else if (newValue === FanControl.FanMode.High) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanComplete?.log);
        } else if (newValue === FanControl.FanMode.On) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.fanComplete?.log);
        } else if (newValue === FanControl.FanMode.Auto) {
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 50, this.fanComplete?.log);
          this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 50, this.fanComplete?.log);
        }
      },
      this.fanComplete?.log,
    );
    await this.fanComplete?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.fanComplete?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.fanComplete?.log);
      },
      this.fanComplete?.log,
    );
    await this.fanComplete?.subscribeAttribute(
      FanControl.Cluster.id,
      'rockSetting',
      (newValue: object, oldValue: object, context) => {
        this.fanComplete?.log.info(
          `Rock setting changed from ${debugStringify(oldValue)} to ${debugStringify(newValue)} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
      },
      this.fanComplete?.log,
    );
    await this.fanComplete?.subscribeAttribute(
      FanControl.Cluster.id,
      'windSetting',
      (newValue: object, oldValue: object, context) => {
        this.fanComplete?.log.info(
          `Wind setting changed from ${debugStringify(oldValue)} to ${debugStringify(newValue)} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
      },
      this.fanComplete?.log,
    );
    await this.fanComplete?.subscribeAttribute(
      FanControl.Cluster.id,
      'airflowDirection',
      (newValue: number, oldValue: number, context) => {
        this.fanComplete?.log.info(
          `Airflow direction changed from ${this.fanDirectionLookup[oldValue]} to ${this.fanDirectionLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
      },
      this.fanComplete?.log,
    );

    // *********************** Create a waterLeakDetector device ***********************
    this.waterLeak = new MatterbridgeEndpoint([waterLeakDetector, bridgedNode, powerSource], { id: 'Water leak detector' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Water leak detector', 'WLD00034', 0xfff1, 'Matterbridge', 'Matterbridge WaterLeakDetector')
      .createDefaultPowerSourceRechargeableBatteryClusterServer()
      .createDefaultBooleanStateClusterServer(false)
      .addRequiredClusterServers()
      .addOptionalClusterServers();

    this.waterLeak = await this.addDevice(this.waterLeak);

    // *********************** Create a waterFreezeDetector device ***********************
    this.waterFreeze = new MatterbridgeEndpoint([waterFreezeDetector, bridgedNode, powerSource], { id: 'Water freeze detector' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Water freeze detector', 'WFD00035', 0xfff1, 'Matterbridge', 'Matterbridge WaterFreezeDetector')
      .createDefaultPowerSourceRechargeableBatteryClusterServer()
      .createDefaultBooleanStateClusterServer(false)
      .addRequiredClusterServers()
      .addOptionalClusterServers();

    this.waterFreeze = await this.addDevice(this.waterFreeze);

    // *********************** Create a rainSensor device ***********************
    this.rain = new MatterbridgeEndpoint([rainSensor, bridgedNode, powerSource], { id: 'Rain sensor' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Rain sensor', 'RAI00036', 0xfff1, 'Matterbridge', 'Matterbridge RainSensor')
      .createDefaultPowerSourceRechargeableBatteryClusterServer()
      .createDefaultIdentifyClusterServer()
      .createDefaultBooleanStateClusterServer(false)
      .createDefaultBooleanStateConfigurationClusterServer();

    this.rain = await this.addDevice(this.rain);

    // *********************** Create a smokeCoAlarm device ***********************
    this.smokeCo = new MatterbridgeEndpoint([smokeCoAlarm, bridgedNode, powerSource], { id: 'SmokeCo alarm sensor' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('SmokeCo alarm sensor', 'SCA00037', 0xfff1, 'Matterbridge', 'Matterbridge SmokeCoAlarm')
      .createDefaultIdentifyClusterServer()
      .createDefaultSmokeCOAlarmClusterServer(SmokeCoAlarm.AlarmState.Normal, SmokeCoAlarm.AlarmState.Normal)
      .createDefaultPowerSourceReplaceableBatteryClusterServer()
      .createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(100);

    this.smokeCo = await this.addDevice(this.smokeCo);

    // *********************** Create a smokeCoAlarm smoke only device ***********************
    this.smokeOnly = new MatterbridgeEndpoint([smokeCoAlarm, bridgedNode, powerSource], { id: 'Smoke alarm sensor' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Smoke alarm sensor', 'SAL00038', 0xfff1, 'Matterbridge', 'Matterbridge SmokeCoAlarm')
      .createDefaultIdentifyClusterServer()
      .createSmokeOnlySmokeCOAlarmClusterServer(SmokeCoAlarm.AlarmState.Normal)
      .createDefaultPowerSourceReplaceableBatteryClusterServer();

    this.smokeOnly = await this.addDevice(this.smokeOnly);

    // *********************** Create a smokeCoAlarm co only device ***********************
    this.coOnly = new MatterbridgeEndpoint([smokeCoAlarm, bridgedNode, powerSource], { id: 'Co alarm sensor' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Co alarm sensor', 'COA00039', 0xfff1, 'Matterbridge', 'Matterbridge SmokeCoAlarm')
      .createDefaultIdentifyClusterServer()
      .createCoOnlySmokeCOAlarmClusterServer(SmokeCoAlarm.AlarmState.Normal)
      .createDefaultPowerSourceReplaceableBatteryClusterServer()
      .createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(100);

    this.coOnly = await this.addDevice(this.coOnly);

    // *********************** Create an airQuality device ***********************
    this.airQuality = new MatterbridgeEndpoint([airQualitySensor, bridgedNode, powerSource], { id: 'Air quality sensor' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Air quality sensor', 'AQS00040', 0xfff1, 'Matterbridge', 'Matterbridge Air Quality Sensor')
      .createDefaultPowerSourceReplaceableBatteryClusterServer(50, PowerSource.BatChargeLevel.Warning, 2900, 'CR2450', 1)
      .addRequiredClusterServers()
      .addClusterServers([TemperatureMeasurement.Cluster.id, RelativeHumidityMeasurement.Cluster.id]) // Apple Home doesn't show the optional TemperatureMeasurement cluster server
      .createDefaultAirQualityClusterServer(AirQuality.AirQualityEnum.Good)
      .createDefaultCarbonMonoxideConcentrationMeasurementClusterServer(10) // Apple Home requires Ppm unit here
      .createDefaultCarbonDioxideConcentrationMeasurementClusterServer(400) // Apple Home requires Ppm unit here
      .createDefaultNitrogenDioxideConcentrationMeasurementClusterServer(1) // Apple Home requires Ugm3 unit here
      .createDefaultOzoneConcentrationMeasurementClusterServer(1) // Apple Home requires Ugm3 unit here
      .createDefaultFormaldehydeConcentrationMeasurementClusterServer(1) // Apple Home doesn't support Formaldehyde!
      .createDefaultPm1ConcentrationMeasurementClusterServer(100) // Apple Home doesn't support Pm1!
      .createDefaultPm25ConcentrationMeasurementClusterServer(100) // Apple Home requires Ugm3 unit here
      .createDefaultPm10ConcentrationMeasurementClusterServer(100) // Apple Home requires Ugm3 unit here
      .createDefaultRadonConcentrationMeasurementClusterServer(100) // Apple Home doesn't support Radon!
      .createDefaultTvocMeasurementClusterServer(100); // Apple Home requires Ugm3 unit here

    this.airQuality = await this.addDevice(this.airQuality);

    // *********************** Create a momentary switch ***********************
    this.momentarySwitch = new MatterbridgeEndpoint([bridgedNode, powerSource], { id: 'Momentary switch composed' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Momentary switch', 'MOS00041', 0xfff1, 'Matterbridge', 'Matterbridge MomentarySwitch')
      .createDefaultIdentifyClusterServer()
      .createDefaultPowerSourceReplaceableBatteryClusterServer(50, PowerSource.BatChargeLevel.Ok, 2900, 'CR2450', 1);

    this.momentarySwitch
      .addChildDeviceType('Momentary switch 1', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.One.namespaceId, tag: NumberTag.One.tag, label: null },
          { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultSwitchClusterServer();

    this.momentarySwitch
      .addChildDeviceType('Momentary switch 2', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.Two.namespaceId, tag: NumberTag.Two.tag, label: null },
          { mfgCode: null, namespaceId: PositionTag.Middle.namespaceId, tag: PositionTag.Middle.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultSwitchClusterServer();

    this.momentarySwitch
      .addChildDeviceType('Momentary switch 3', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.Three.namespaceId, tag: NumberTag.Three.tag, label: null },
          { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultSwitchClusterServer();

    const switch4 = this.momentarySwitch
      .addChildDeviceType('Momentary switch 4', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.Four.namespaceId, tag: NumberTag.Four.tag, label: null },
          { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: null },
          { mfgCode: null, namespaceId: SwitchesTag.Custom.namespaceId, tag: SwitchesTag.Custom.tag, label: 'Turn on' },
          { mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null },
          { mfgCode: null, namespaceId: AreaNamespaceTag.Bedroom.namespaceId, tag: AreaNamespaceTag.Bedroom.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultMomentarySwitchClusterServer();

    const switch5 = this.momentarySwitch
      .addChildDeviceType('Momentary switch 5', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.Five.namespaceId, tag: NumberTag.Five.tag, label: null },
          { mfgCode: null, namespaceId: PositionTag.Middle.namespaceId, tag: PositionTag.Middle.tag, label: null },
          { mfgCode: null, namespaceId: SwitchesTag.Custom.namespaceId, tag: SwitchesTag.Custom.tag, label: 'Turn off' },
          { mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null },
          { mfgCode: null, namespaceId: AreaNamespaceTag.Bedroom.namespaceId, tag: AreaNamespaceTag.Bedroom.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultMomentarySwitchClusterServer();

    const switch6 = this.momentarySwitch
      .addChildDeviceType('Momentary switch 6', [genericSwitch], {
        tagList: [
          { mfgCode: null, namespaceId: NumberTag.Seven.namespaceId, tag: NumberTag.Seven.tag, label: null }, // Intentionally use seven here to show when the controllers use it
          { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: null },
          { mfgCode: null, namespaceId: SwitchesTag.Custom.namespaceId, tag: SwitchesTag.Custom.tag, label: 'Toggle' },
          { mfgCode: null, namespaceId: LocationTag.Indoor.namespaceId, tag: LocationTag.Indoor.tag, label: null },
          { mfgCode: null, namespaceId: AreaNamespaceTag.Bedroom.namespaceId, tag: AreaNamespaceTag.Bedroom.tag, label: null },
        ],
      })
      .createDefaultIdentifyClusterServer()
      .createDefaultMomentarySwitchClusterServer();

    this.momentarySwitch = await this.addDevice(this.momentarySwitch);

    if (this.momentarySwitch) {
      // This is just a test. No effect so far on any controller
      await switch4.addFixedLabel('name', 'Switch 4');
      await switch4.addFixedLabel('room', 'Living Room');
      await switch4.addFixedLabel('switch', 'Switch 4');
      await switch4.addFixedLabel('button', 'Button 4');
      await switch5.addFixedLabel('name', 'Switch 5');
      await switch5.addFixedLabel('room', 'Living Room');
      await switch5.addFixedLabel('switch', 'Switch 5');
      await switch5.addFixedLabel('button', 'Button 5');
      await switch6.addFixedLabel('name', 'Switch 6');
      await switch6.addFixedLabel('room', 'Living Room');
      await switch6.addFixedLabel('switch', 'Switch 6');
      await switch6.addFixedLabel('button', 'Button 6');
    }

    // *********************** Create a latching switch *****************************/
    this.latchingSwitch = new MatterbridgeEndpoint([genericSwitch, bridgedNode, powerSource], { id: 'Latching switch' }, this.config.debug)
      .createDefaultBridgedDeviceBasicInformationClusterServer('Latching switch', 'LAS00042', 0xfff1, 'Matterbridge', 'Matterbridge LatchingSwitch')
      .createDefaultIdentifyClusterServer()
      .createDefaultLatchingSwitchClusterServer()
      .createDefaultPowerSourceReplaceableBatteryClusterServer(10, PowerSource.BatChargeLevel.Critical, 2850, 'CR2032', 1);

    this.latchingSwitch = await this.addDevice(this.latchingSwitch);

    // *********************** Create a vacuum *****************************
    /*
    The RVC is supported correctly by the Home app (all commands work).

    The bad news is that right now the Apple Home app only shows the RVC as a single device (not bridged) or a single device in the bridge. 

    If the RVC is in a bridge with other devices, the whole Home app crashes... so don't try it. If your controller is Apple Home use server mode for the RVC.
    */
    this.roboticVacuum = new RoboticVacuumCleaner(
      'Robot Vacuum',
      'RVC00043',
      this.config.enableServerRvc === true ? 'server' : undefined,
      1, // currentRunMode
      [
        { label: 'Idle', mode: 1, modeTags: [{ value: RvcRunMode.ModeTag.Idle }] },
        { label: 'Cleaning', mode: 2, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }] },
        { label: 'Mapping', mode: 3, modeTags: [{ value: RvcRunMode.ModeTag.Mapping }] },
        { label: 'SpotCleaning', mode: 4, modeTags: [{ value: RvcRunMode.ModeTag.Cleaning }, { value: RvcRunMode.ModeTag.Max }] },
      ], // supportedRunModes
      1, // currentCleanMode
      [
        { label: 'Vacuum', mode: 1, modeTags: [{ value: RvcCleanMode.ModeTag.Vacuum }] },
        { label: 'Mop', mode: 2, modeTags: [{ value: RvcCleanMode.ModeTag.Mop }] },
        { label: 'Clean', mode: 3, modeTags: [{ value: RvcCleanMode.ModeTag.DeepClean }] },
      ], // supportedCleanModes
      null, // currentPhase
      null, // phaseList
      undefined, // operationalState
      undefined, // operationalStateList
      [
        {
          areaId: 1,
          mapId: 1,
          areaInfo: { locationInfo: { locationName: 'Living', floorNumber: 0, areaType: AreaNamespaceTag.LivingRoom.tag }, landmarkInfo: null },
        },
        {
          areaId: 2,
          mapId: 1,
          areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: AreaNamespaceTag.Kitchen.tag }, landmarkInfo: null },
        },
        {
          areaId: 3,
          mapId: 2,
          areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 1, areaType: AreaNamespaceTag.Bedroom.tag }, landmarkInfo: null },
        },
        {
          areaId: 4,
          mapId: 2,
          areaInfo: { locationInfo: { locationName: 'Bathroom', floorNumber: 1, areaType: AreaNamespaceTag.Bathroom.tag }, landmarkInfo: null },
        },
      ], // supportedAreas
      [], // selectedAreas
      1, // currentArea
      [
        {
          mapId: 1,
          name: 'Ground floor',
        },
        {
          mapId: 2,
          name: 'First floor',
        },
      ], // supportedMaps
    );
    if (this.config.enableServerRvc === true) {
      this.log.notice('RVC is in server mode so it has its own QR code (it shows in the "Devices" panel of the Home page)');
    }
    this.roboticVacuum = await this.addDevice(this.roboticVacuum);

    // *********************** Create a water heater ***************************
    this.waterHeater = new WaterHeater('Water Heater', 'WHT00044', 50, 60, 20, 80, undefined, 85, 220_000, 1_000, 220_000, 12_000_000, 500_000, 3_000_000);
    this.waterHeater = await this.addDevice(this.waterHeater);

    // *********************** Create an Evse ***************************
    this.evse = new Evse(
      'Evse',
      'EVS00045',
      1,
      [
        { label: 'On demand', mode: 1, modeTags: [{ value: EnergyEvseMode.ModeTag.Manual }] },
        { label: 'Scheduled', mode: 2, modeTags: [{ value: EnergyEvseMode.ModeTag.TimeOfUse }] },
        { label: 'Solar Charging', mode: 3, modeTags: [{ value: EnergyEvseMode.ModeTag.SolarCharging }] },
        { label: 'Solar Charging Scheduled', mode: 4, modeTags: [{ value: EnergyEvseMode.ModeTag.SolarCharging }, { value: EnergyEvseMode.ModeTag.TimeOfUse }] },
      ],
      EnergyEvse.State.PluggedInCharging,
      EnergyEvse.SupplyState.ChargingEnabled,
      EnergyEvse.FaultState.NoError,
      220_000, // 220 volt
      10_000, // 10 ampere
      2_200_000, // 2200 watt
      1_000_000, // 1 kWh
      500_000, // 500 Wh
      32_000_000, // 32 kWh
    );
    this.evse = await this.addDevice(this.evse);

    // *********************** Create a SolarPower **************************
    this.solarPower = new SolarPower(
      'Solar Power',
      'SOL00046',
      220_000, // 220 volt
      10_000, // 10 ampere
      2200_000, // 2200 watt
      2_200_000, // 2.2 kWh
      -10_000_000, // -10 kWh
      500_000, // 500 Wh
    );
    this.solarPower = await this.addDevice(this.solarPower);

    // *********************** Create a BatteryStorage **************************
    this.batteryStorage = new BatteryStorage(
      'Battery Storage',
      'BST00047',
      75,
      PowerSource.BatChargeLevel.Ok,
      220_000, // 220 volt
      10_000, // 10 ampere
      2_200_000, // 2200 watt
      1_000_000, // 1 kWh
      2_000_000, // 2 kWh
      -2_000_000, // -2 kWh
      3_000_000, // 3 kWh
    );
    this.batteryStorage = await this.addDevice(this.batteryStorage);

    // *********************** Create an HeatPump **************************
    this.heatPump = new HeatPump(
      'Heat Pump',
      'HPU00048',
      220_000, // 220 volt
      10_000, // 10 ampere
      2_200_000, // 2200 watt
      1_000_000, // 1 kWh
      500_000, // 500 watt
      3_000_000, // 3 kWh
    );
    this.heatPump = await this.addDevice(this.heatPump);

    // *********************** Create a LaundryWasher **************************
    this.laundryWasher = new LaundryWasher('Laundry Washer', 'LWA00049');
    this.laundryWasher = await this.addDevice(this.laundryWasher);

    // *********************** Create a LaundryDryer **************************
    this.laundryDryer = new LaundryDryer('Laundry Dryer', 'LDR00050');
    this.laundryDryer = await this.addDevice(this.laundryDryer);

    // *********************** Create a Dishwasher **************************
    this.dishwasher = new Dishwasher('Dishwasher', 'DSW00051');
    this.dishwasher = await this.addDevice(this.dishwasher);

    // *********************** Create an Extractor Hood **************************
    this.extractorHood = new ExtractorHood('Extractor Hood', 'EXH00052');
    this.extractorHood = await this.addDevice(this.extractorHood);

    // *********************** Create an Microwave Oven **************************
    this.microwaveOven = new MicrowaveOven('Microwave Oven', 'MWO00053');
    this.microwaveOven = await this.addDevice(this.microwaveOven);

    // *********************** Create an Oven **************************
    this.oven = new Oven('Oven', 'OVN00054');
    this.oven.addCabinet(
      'Upper Cabinet',
      [{ mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label }],
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ['pre-heating', 'pre-heated', 'cooling down'],
    );
    this.oven.addCabinet(
      'Lower Cabinet',
      [{ mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label }],
      3,
      [
        { label: 'Convection', mode: 1, modeTags: [{ value: OvenMode.ModeTag.Convection }] },
        { label: 'Clean', mode: 2, modeTags: [{ value: OvenMode.ModeTag.Clean }] },
        { label: 'Steam', mode: 3, modeTags: [{ value: OvenMode.ModeTag.Steam }] },
      ],
      2,
      ['180°', '190°', '200°'],
      OperationalState.OperationalStateEnum.Running,
      undefined,
      ['pre-heating', 'pre-heated', 'cooling down'],
    );
    this.oven = (await this.addDevice(this.oven)) as Oven | undefined;

    // *********************** Create an Cooktop **************************
    this.cooktop = new Cooktop('Cooktop', 'CKT00055');
    this.cooktop.addSurface('Surface Top Left', [
      { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
      { mfgCode: null, namespaceId: PositionTag.Left.namespaceId, tag: PositionTag.Left.tag, label: PositionTag.Left.label },
    ]);
    this.cooktop.addSurface('Surface Top Right', [
      { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: PositionTag.Top.label },
      { mfgCode: null, namespaceId: PositionTag.Right.namespaceId, tag: PositionTag.Right.tag, label: PositionTag.Right.label },
    ]);
    this.cooktop.addSurface('Surface Bottom Left', [
      { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label },
      { mfgCode: null, namespaceId: PositionTag.Left.namespaceId, tag: PositionTag.Left.tag, label: PositionTag.Left.label },
    ]);
    this.cooktop.addSurface('Surface Bottom Right', [
      { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: PositionTag.Bottom.label },
      { mfgCode: null, namespaceId: PositionTag.Right.namespaceId, tag: PositionTag.Right.tag, label: PositionTag.Right.label },
    ]);
    this.cooktop = (await this.addDevice(this.cooktop)) as Cooktop | undefined;

    // *********************** Create an Refrigerator **************************
    const refrigerator = new Refrigerator('Refrigerator', 'REF00056');
    refrigerator.addCabinet(
      'Refrigerator Top',
      [
        { mfgCode: null, namespaceId: PositionTag.Top.namespaceId, tag: PositionTag.Top.tag, label: 'Refrigerator Top' },
        { mfgCode: null, namespaceId: RefrigeratorTag.Refrigerator.namespaceId, tag: RefrigeratorTag.Refrigerator.tag, label: RefrigeratorTag.Refrigerator.label },
      ],
      1,
      [
        { label: 'Auto', mode: 1, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.Auto }] },
        { label: 'RapidCool', mode: 2, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidCool }] },
      ],
      undefined,
      undefined,
      1200,
    );
    refrigerator.addCabinet(
      'Freezer Bottom',
      [
        { mfgCode: null, namespaceId: PositionTag.Bottom.namespaceId, tag: PositionTag.Bottom.tag, label: 'Freezer Bottom' },
        { mfgCode: null, namespaceId: RefrigeratorTag.Freezer.namespaceId, tag: RefrigeratorTag.Freezer.tag, label: RefrigeratorTag.Freezer.label },
      ],
      1,
      [
        { label: 'Auto', mode: 1, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.Auto }] },
        { label: 'RapidFreeze', mode: 2, modeTags: [{ value: RefrigeratorAndTemperatureControlledCabinetMode.ModeTag.RapidFreeze }] },
      ],
      undefined,
      undefined,
      -1000,
    );
    this.refrigerator = (await this.addDevice(refrigerator)) as Refrigerator | undefined;

    // *********************** Create a airConditioner device ***********************
    this.airConditioner = new AirConditioner('Air Conditioner', 'ACO00027', {
      localTemperature: 20,
      occupiedCoolingSetpoint: 18,
      occupiedHeatingSetpoint: 22,
      fanMode: FanControl.FanMode.Auto,
    })
      .createDefaultTemperatureMeasurementClusterServer(20 * 100)
      .createDefaultRelativeHumidityMeasurementClusterServer(50 * 100)
      .addRequiredClusterServers();

    this.airConditioner = await this.addDevice(this.airConditioner);

    this.airConditioner?.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.airConditioner?.log.info(`Command identify called identifyTime:${identifyTime}`);
    });
    // Dead front OnOff cluster
    this.airConditioner?.addCommandHandler('on', async () => {
      this.airConditioner?.log.info('Command on called');
      await this.airConditioner?.setAttribute(ThermostatCluster.id, 'localTemperature', 20 * 100, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 20 * 100, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', 50 * 100, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 50, this.airConditioner?.log);
    });
    this.airConditioner?.addCommandHandler('off', async () => {
      this.airConditioner?.log.info('Command off called');
      await this.airConditioner?.setAttribute(ThermostatCluster.id, 'localTemperature', null, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', null, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', null, this.airConditioner?.log);
      await this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', null, this.airConditioner?.log);
    });
    // Fan component of AirConditioner
    await this.airConditioner?.subscribeAttribute(
      FanControl.Cluster.id,
      'fanMode',
      (newValue: FanControl.FanMode, oldValue: FanControl.FanMode, context) => {
        this.airConditioner?.log.info(
          `Fan mode changed from ${this.fanModeLookup[oldValue]} to ${this.fanModeLookup[newValue]} context: ${context.offline === true ? 'offline' : 'online'}`,
        );
        if (context.offline === true) return; // Do not set attributes when offline
        if (newValue === FanControl.FanMode.Off) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.airConditioner?.log);
        } else if (newValue === FanControl.FanMode.Low) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 33, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 33, this.airConditioner?.log);
        } else if (newValue === FanControl.FanMode.Medium) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 66, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 66, this.airConditioner?.log);
        } else if (newValue === FanControl.FanMode.High) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.airConditioner?.log);
        } else if (newValue === FanControl.FanMode.On) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 100, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 100, this.airConditioner?.log);
        } else if (newValue === FanControl.FanMode.Auto) {
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentSetting', 50, this.airConditioner?.log);
          this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 50, this.airConditioner?.log);
        }
      },
      this.airConditioner?.log,
    );
    await this.airConditioner?.subscribeAttribute(
      FanControl.Cluster.id,
      'percentSetting',
      (newValue: number | null, oldValue: number | null, context) => {
        this.airConditioner?.log.info(`Percent setting changed from ${oldValue} to ${newValue} context: ${context.offline === true ? 'offline' : 'online'}`);
        if (context.offline === true) return; // Do not set attributes when offline
        if (isValidNumber(newValue, 0, 100)) this.airConditioner?.setAttribute(FanControl.Cluster.id, 'percentCurrent', newValue, this.airConditioner?.log);
      },
      this.airConditioner?.log,
    );

    // *********************** Create a Speaker device ***********************
    this.speaker = new Speaker('Speaker', 'SPE00057', false, 100);
    this.speaker = (await this.addDevice(this.speaker)) as Speaker | undefined;
  }

  override async onConfigure() {
    await super.onConfigure();
    this.log.info('onConfigure called');

    // Use interval for appliances animation
    if (this.config.useInterval) {
      this.phaseInterval = setInterval(async () => {
        this.phase = this.phase + 1 > 10 ? 0 : this.phase + 1;
        this.log.info(`Appliances animation phase ${this.phase}`);

        // Dead front and onOff for Appliances
        if (this.phase === 0) {
          // Set dead front onOff true for Appliances: brings the appliances out of the "dead front" state
          if (this.airConditioner || this.laundryWasher || this.laundryDryer || this.dishwasher) this.log.info(`Set appliances dead front OnOff to true`);
          await this.airConditioner?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.airConditioner.log);
          await this.laundryWasher?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.laundryWasher.log);
          await this.laundryDryer?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.laundryDryer.log);
          await this.dishwasher?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.dishwasher.log);

          // Set offOnly onOff cluster to true for Cooktop and the Surfaces: brings the appliances on
          this.cooktop?.log.info(`Set Cooktop offOnly onOff clusters to true`);
          await this.cooktop?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.cooktop.log);
          await this.cooktop?.getChildEndpointByName('SurfaceTopLeft')?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.cooktop?.log);
          await this.cooktop?.getChildEndpointByName('SurfaceTopRight')?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.cooktop?.log);
        }

        if (this.roboticVacuum) {
          // RvcRunMode: 1 = Idle 2 = Cleaning 3 = Mapping 4 = Cleaning + Max
          // RvcCleanMode 1 = Vacuum 2 = Mop 3 = Clean
          if (this.phase === 0) {
            this.roboticVacuum.log.info(`RVC: Reset to Idle, Vacuum, Docked`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 200, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batChargeState', PowerSource.BatChargeState.IsAtFullCharge, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batVoltage', 6000, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcCleanMode', 'currentMode', 1, this.roboticVacuum.log); // Vacuum
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Docked, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
          }
          if (this.phase === 1) {
            this.roboticVacuum.log.info(`RVC: start cleaning...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batChargeState', PowerSource.BatChargeState.IsNotCharging, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batVoltage', 5900, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.roboticVacuum.log); // Cleaning
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Running, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('ServiceArea', 'currentArea', 1, this.roboticVacuum.log); // Living
            await this.roboticVacuum.setAttribute('ServiceArea', 'estimatedEndTime', Math.floor(Date.now() / 1000) + 300, this.roboticVacuum.log); // Epoch time in seconds
          }
          if (this.phase === 2) {
            this.roboticVacuum.log.info(`RVC: pause cleaning...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 180, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.roboticVacuum.log); // Cleaning
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Paused, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
          }
          if (this.phase === 3) {
            this.roboticVacuum.log.info(`RVC: resume cleaning...`);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 2, this.roboticVacuum.log); // Cleaning
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Running, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('ServiceArea', 'currentArea', 2, this.roboticVacuum.log); // Kitchen
            await this.roboticVacuum.setAttribute('ServiceArea', 'estimatedEndTime', Math.floor(Date.now() / 1000) + 180, this.roboticVacuum.log); // Epoch time in seconds
          }
          if (this.phase === 4) {
            this.roboticVacuum.log.info(`RVC: stop cleaning...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 160, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Stopped, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('ServiceArea', 'estimatedEndTime', 0, this.roboticVacuum.log); // A value of 0 means that the operation has completed.
          }
          if (this.phase === 5) {
            this.roboticVacuum.log.info(`RVC: going home...`);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.SeekingCharger, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
          }
          if (this.phase === 6) {
            this.roboticVacuum.log.info(`RVC: charging...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 180, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batChargeState', PowerSource.BatChargeState.IsCharging, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batVoltage', 6100, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Charging, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('ServiceArea', 'currentArea', 1, this.roboticVacuum.log); // Living
          }
          if (this.phase === 7) {
            this.roboticVacuum.log.info(`RVC: charging...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 190, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Charging, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
          }
          if (this.phase === 8) {
            this.roboticVacuum.log.info(`RVC: docked...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 200, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batChargeState', PowerSource.BatChargeState.IsAtFullCharge, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batVoltage', 6000, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Docked, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.NoError }, this.roboticVacuum.log);
          }
          if (this.phase === 9) {
            this.roboticVacuum.log.info(`RVC: error DustBinFull...`);
            await this.roboticVacuum.setAttribute('PowerSource', 'batPercentRemaining', 200, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batChargeState', PowerSource.BatChargeState.IsAtFullCharge, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('PowerSource', 'batVoltage', 6000, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcRunMode', 'currentMode', 1, this.roboticVacuum.log); // Idle
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalState', RvcOperationalState.OperationalState.Error, this.roboticVacuum.log);
            await this.roboticVacuum.setAttribute('RvcOperationalState', 'operationalError', { errorStateId: RvcOperationalState.ErrorState.DustBinFull }, this.roboticVacuum.log);
          }
        }

        if (this.oven) {
          const upperCabinet = this.oven.getChildEndpointByName('UpperCabinet');
          const lowerCabinet = this.oven.getChildEndpointByName('LowerCabinet');
          if (this.phase === 0) {
            await upperCabinet?.setAttribute('OvenMode', 'currentMode', 3, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 2000, upperCabinet.log);

            await lowerCabinet?.setAttribute('OvenMode', 'currentMode', 3, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 2000, lowerCabinet.log);
          }
          if (this.phase === 1) {
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Running, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 0, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 5000, upperCabinet.log);

            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Running, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 0, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 5000, lowerCabinet.log);
          }
          if (this.phase === 2) {
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Running, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 1, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 19000, upperCabinet.log);

            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Running, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 1, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 20000, lowerCabinet.log);
          }
          if (this.phase === 8) {
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 10000, upperCabinet.log);

            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 10000, lowerCabinet.log);
          }
          if (this.phase === 9) {
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, upperCabinet.log);
            await upperCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, upperCabinet.log);
            await upperCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 5000, upperCabinet.log);

            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'operationalState', OperationalState.OperationalStateEnum.Stopped, lowerCabinet.log);
            await lowerCabinet?.setAttribute('OvenCavityOperationalState', 'currentPhase', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, lowerCabinet.log);
            await lowerCabinet?.setAttribute('TemperatureMeasurement', 'measuredValue', 5000, lowerCabinet.log);
          }
        }

        if (this.heatPump) {
          const optOutState = this.heatPump?.getAttribute('DeviceEnergyManagement', 'optOutState', this.heatPump.log);
          if (optOutState === DeviceEnergyManagement.OptOutState.NoOptOut)
            await this.heatPump?.setAttribute('DeviceEnergyManagement', 'optOutState', DeviceEnergyManagement.OptOutState.LocalOptOut, this.heatPump.log);
          if (optOutState === DeviceEnergyManagement.OptOutState.LocalOptOut)
            await this.heatPump?.setAttribute('DeviceEnergyManagement', 'optOutState', DeviceEnergyManagement.OptOutState.GridOptOut, this.heatPump.log);
          if (optOutState === DeviceEnergyManagement.OptOutState.GridOptOut)
            await this.heatPump?.setAttribute('DeviceEnergyManagement', 'optOutState', DeviceEnergyManagement.OptOutState.OptOut, this.heatPump.log);
          if (optOutState === DeviceEnergyManagement.OptOutState.OptOut)
            await this.heatPump?.setAttribute('DeviceEnergyManagement', 'optOutState', DeviceEnergyManagement.OptOutState.NoOptOut, this.heatPump.log);
        }

        if (this.refrigerator) {
          if (this.phase === 0) {
            let mode;
            const refrigerator = this.refrigerator.getChildEndpointByName('RefrigeratorTop');
            mode = refrigerator?.getAttribute('RefrigeratorAndTemperatureControlledCabinetMode', 'currentMode', refrigerator.log);
            mode = mode === 1 ? 2 : 1; // 1 Auto 2 RapidCool
            await refrigerator?.setAttribute('RefrigeratorAndTemperatureControlledCabinetMode', 'currentMode', mode, refrigerator.log);
            if (mode === 1) await refrigerator?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, refrigerator.log);
            if (mode === 1) await refrigerator?.setAttribute('TemperatureMeasurement', 'measuredValue', 1200, refrigerator.log);
            if (mode === 2) await refrigerator?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 0, refrigerator.log);
            if (mode === 2) await refrigerator?.setAttribute('TemperatureMeasurement', 'measuredValue', 1000, refrigerator.log);

            const freezer = this.refrigerator.getChildEndpointByName('FreezerBottom');
            mode = freezer?.getAttribute('RefrigeratorAndTemperatureControlledCabinetMode', 'currentMode', freezer.log);
            mode = mode === 1 ? 2 : 1; // 1 Auto 2 RapidFreeze
            await freezer?.setAttribute('RefrigeratorAndTemperatureControlledCabinetMode', 'currentMode', mode, freezer.log);
            if (mode === 1) await freezer?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 2, freezer.log);
            if (mode === 1) await freezer?.setAttribute('TemperatureMeasurement', 'measuredValue', -1000, freezer.log);
            if (mode === 2) await freezer?.setAttribute('TemperatureControl', 'selectedTemperatureLevel', 0, freezer.log);
            if (mode === 2) await freezer?.setAttribute('TemperatureMeasurement', 'measuredValue', -1500, freezer.log);
          }
          if (this.phase === 1) await this.refrigerator.setDoorOpenState('RefrigeratorTop', true);
          if (this.phase === 2) await this.refrigerator.triggerDoorOpenState('RefrigeratorTop', true);
          if (this.phase === 4) await this.refrigerator.setDoorOpenState('RefrigeratorTop', false);
          if (this.phase === 4) await this.refrigerator.triggerDoorOpenState('RefrigeratorTop', false);

          if (this.phase === 6) await this.refrigerator.setDoorOpenState('FreezerBottom', true);
          if (this.phase === 7) await this.refrigerator.triggerDoorOpenState('FreezerBottom', true);
          if (this.phase === 9) await this.refrigerator.setDoorOpenState('FreezerBottom', false);
          if (this.phase === 9) await this.refrigerator.triggerDoorOpenState('FreezerBottom', false);
        }
      }, 10 * 1000);
    }

    // Use interval for sensor updates
    if (this.config.useInterval) {
      this.sensorInterval = setInterval(
        async () => {
          let value = this.door?.getAttribute(BooleanState.Cluster.id, 'stateValue', this.door.log);
          if (isValidBoolean(value)) {
            value = !value;
            await this.door?.setAttribute(BooleanState.Cluster.id, 'stateValue', value, this.door.log);
            this.door?.log.info(`Set door stateValue to ${value}`);
          }

          const occupancyValue = this.occupancy?.getAttribute(OccupancySensing.Cluster.id, 'occupancy', this.occupancy.log) as { occupied: boolean };
          if (isValidObject(occupancyValue, 1)) {
            occupancyValue.occupied = !occupancyValue.occupied;
            await this.occupancy?.setAttribute(OccupancySensing.Cluster.id, 'occupancy', occupancyValue, this.occupancy.log);
            this.occupancy?.log.info(`Set occupancy to ${occupancyValue.occupied}`);
          }

          value = this.illuminance?.getAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue', this.illuminance.log);
          if (isValidNumber(value, 0, 0xfffe)) {
            value = matterToLux(value);
            value = value + 10 < 500 ? value + 10 : 1;
            await this.illuminance?.setAttribute(IlluminanceMeasurement.Cluster.id, 'measuredValue', luxToMatter(value), this.illuminance.log);
            this.illuminance?.log.info(`Set illuminance measuredValue to ${value}`);
          }

          value = this.temperature?.getAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', this.temperature.log);
          if (isValidNumber(value, 0, 0xfffe)) {
            value = value + 100 < 3000 ? value + 100 : 1000;
            await this.temperature?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', value, this.temperature.log);
            await this.climate?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', value, this.climate.log);
            this.temperature?.log.info(`Set temperature measuredValue to ${value}`);
          }

          value = this.humidity?.getAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', this.humidity.log);
          if (isValidNumber(value, 0, 0xfffe)) {
            value = value + 100 < 10000 ? value + 100 : 100;
            await this.humidity?.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', value, this.humidity.log);
            await this.climate?.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', value, this.climate.log);
            this.humidity?.log.info(`Set humidity measuredValue to ${value}`);
          }

          value = this.pressure?.getAttribute(PressureMeasurement.Cluster.id, 'measuredValue', this.pressure.log);
          if (isValidNumber(value, 0, 0xfffe)) {
            value = value + 10 < 9900 ? value + 10 : 8600;
            await this.pressure?.setAttribute(PressureMeasurement.Cluster.id, 'measuredValue', value, this.pressure.log);
            await this.climate?.setAttribute(PressureMeasurement.Cluster.id, 'measuredValue', value, this.climate.log);
            this.pressure?.log.info(`Set pressure measuredValue to ${value}`);
          }

          value = this.flow?.getAttribute(FlowMeasurement.Cluster.id, 'measuredValue', this.flow.log);
          if (isValidNumber(value, 0, 0xfffe)) {
            value = value + 1 < 50 ? value + 1 : 1;
            await this.flow?.setAttribute(FlowMeasurement.Cluster.id, 'measuredValue', value, this.flow.log);
            this.flow?.log.info(`Set flow measuredValue to ${value}`);
          }
        },
        60 * 1000 + 900,
      );
    }

    // Set switch to off
    await this.switch?.setAttribute(OnOff.Cluster.id, 'onOff', this.intervalOnOff, this.switch.log);
    await this.mountedOnOffSwitch?.setAttribute(OnOff.Cluster.id, 'onOff', this.intervalOnOff, this.mountedOnOffSwitch.log);
    this.switch?.log.info(`Set switch initial onOff to ${this.intervalOnOff}`);
    if (this.config.useInterval) {
      // Toggle switch onOff every minute
      this.switchInterval = setInterval(
        async () => {
          await this.switch?.setAttribute(OnOff.Cluster.id, 'onOff', this.intervalOnOff, this.switch.log);
          await this.mountedOnOffSwitch?.setAttribute(OnOff.Cluster.id, 'onOff', this.intervalOnOff, this.mountedOnOffSwitch.log);
          this.log.info(`Set switches onOff to ${this.intervalOnOff}`);
          this.intervalOnOff = !this.intervalOnOff;
        },
        60 * 1000 + 100,
      );
    }

    // Set light on/off to off
    await this.lightOnOff?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightOnOff.log);
    this.lightOnOff?.log.info('Set light initial onOff to false.');

    // Set dimmer on/off to off
    await this.dimmer?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.dimmer.log);
    await this.dimmer?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 1, this.dimmer.log);
    await this.mountedDimmerSwitch?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.mountedDimmerSwitch.log);
    await this.mountedDimmerSwitch?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 1, this.mountedDimmerSwitch.log);
    this.dimmer?.log.info(`Set dimmer initial onOff to false, currentLevel to 1.`);

    // Set light to off, level to 0 and hue to 0 and saturation to 50% (pink color)
    await this.light?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.light.log);
    await this.light?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 200, this.light.log);
    await this.light?.setAttribute(ColorControl.Cluster.id, 'currentHue', 0, this.light.log);
    await this.light?.setAttribute(ColorControl.Cluster.id, 'currentSaturation', 128, this.light.log);
    await this.light?.configureColorControlMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    this.light?.log.info('Set light initial onOff to false, currentLevel to 1, hue to 0 and saturation to 50%.');

    // Set light XY to true, level to 100% and XY to red
    await this.lightXY?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightXY.log);
    await this.lightXY?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 254, this.lightXY.log);
    await this.lightXY?.setAttribute(ColorControl.Cluster.id, 'currentX', 0.7006 * 65536, this.lightXY.log);
    await this.lightXY?.setAttribute(ColorControl.Cluster.id, 'currentY', 0.2993 * 65536, this.lightXY.log);
    await this.lightXY?.configureColorControlMode(ColorControl.ColorMode.CurrentXAndCurrentY);
    this.lightXY?.log.info('Set light XY initial onOff to true, currentLevel to 254, X to 0.7006 and Y to 0.2993.');

    // Set light HS to off, level to 0 and hue to 0 and saturation to 50% (pink color)
    await this.lightHS?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightHS.log);
    await this.lightHS?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 1, this.lightHS.log);
    await this.lightHS?.setAttribute(ColorControl.Cluster.id, 'currentHue', 0, this.lightHS.log);
    await this.lightHS?.setAttribute(ColorControl.Cluster.id, 'currentSaturation', 128, this.lightHS.log);
    await this.lightHS?.configureColorControlMode(ColorControl.ColorMode.CurrentHueAndCurrentSaturation);
    this.lightHS?.log.info('Set light HS initial onOff to false, currentLevel to 1, hue to 0 and saturation to 50%.');

    // Set light CT to true, level to 50% and colorTemperatureMireds to 250
    await this.lightCT?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightCT.log);
    await this.lightCT?.setAttribute(LevelControl.Cluster.id, 'currentLevel', 128, this.lightCT.log);
    await this.lightCT?.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', 250, this.lightCT.log);
    await this.lightCT?.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
    this.lightCT?.log.info('Set light CT initial onOff to true, currentLevel to 128, colorTemperatureMireds to 250.');

    if (this.config.useInterval) {
      this.lightInterval = setInterval(
        async () => {
          this.intervalLevel += 10;
          if (this.intervalLevel >= 250) {
            this.intervalLevel = 1;
            await this.lightOnOff?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightOnOff.log);
            await this.dimmer?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.dimmer.log);
            await this.mountedDimmerSwitch?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.mountedDimmerSwitch.log);
            await this.light?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.light.log);
            await this.lightXY?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightXY.log);
            await this.lightHS?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightHS.log);
            await this.lightCT?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.lightCT.log);
            this.log.info('Set lights onOff to false');
          } else {
            await this.lightOnOff?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightOnOff?.log);
            await this.dimmer?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.dimmer.log);
            await this.mountedDimmerSwitch?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.mountedDimmerSwitch.log);
            await this.light?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.light.log);
            await this.lightXY?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightXY.log);
            await this.lightHS?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightHS.log);
            await this.lightCT?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.lightCT.log);
            this.log.info('Set lights onOff to true');
            await this.dimmer?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.dimmer.log);
            await this.mountedDimmerSwitch?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.mountedDimmerSwitch.log);
            await this.light?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.light.log);
            await this.lightXY?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.lightXY.log);
            await this.lightHS?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.lightHS.log);
            await this.lightCT?.setAttribute(LevelControl.Cluster.id, 'currentLevel', this.intervalLevel, this.lightCT.log);
            this.log.info(`Set lights currentLevel to ${this.intervalLevel}`);
          }
          this.intervalColorTemperature += 50;
          if (this.intervalColorTemperature > 500) {
            this.intervalColorTemperature = 147;
          }
          await this.light?.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', this.intervalColorTemperature, this.light.log);
          await this.lightHS?.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', this.intervalColorTemperature, this.lightHS.log);
          await this.lightXY?.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', this.intervalColorTemperature, this.lightXY.log);
          await this.lightCT?.setAttribute(ColorControl.Cluster.id, 'colorTemperatureMireds', this.intervalColorTemperature, this.lightCT.log);
          await this.light?.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
          await this.lightHS?.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
          await this.lightXY?.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
          await this.lightCT?.configureColorControlMode(ColorControl.ColorMode.ColorTemperatureMireds);
          this.log.info(`Set lights colorTemperatureMireds to ${this.intervalColorTemperature}`);
        },
        60 * 1000 + 200,
      );
    }

    // Set outlet to off
    await this.outlet?.setAttribute(OnOff.Cluster.id, 'onOff', false, this.outlet.log);
    this.outlet?.log.info('Set outlet initial onOff to false');
    if (this.config.useInterval) {
      // Toggle outlet onOff every minute
      this.outletInterval = setInterval(
        async () => {
          const state = this.outlet?.getAttribute(OnOff.Cluster.id, 'onOff', this.outlet.log);
          if (isValidBoolean(state)) {
            await this.outlet?.setAttribute(OnOff.Cluster.id, 'onOff', !state, this.outlet.log);
            this.outlet?.log.info(`Set outlet onOff to ${!state}`);
          }
        },
        60 * 1000 + 300,
      );
    }

    // Set cover to target = current position and status to stopped (current position is persisted in the cluster)
    await this.coverLift?.setWindowCoveringTargetAsCurrentAndStopped();
    this.coverLift?.log.info('Set cover initial targetPositionLiftPercent100ths = currentPositionLiftPercent100ths and operationalStatus to Stopped.');
    if (this.config.useInterval) {
      // Increment cover position every minute
      this.coverInterval = setInterval(
        async () => {
          let position = this.coverLift?.getAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', this.coverLift.log);
          if (isValidNumber(position, 0, 10000)) {
            position = position > 9000 ? 0 : position + 1000;
            await this.coverLift?.setAttribute(WindowCovering.Cluster.id, 'targetPositionLiftPercent100ths', position, this.coverLift.log);
            await this.coverLift?.setAttribute(WindowCovering.Cluster.id, 'currentPositionLiftPercent100ths', position, this.coverLift.log);
            await this.coverLift?.setAttribute(
              WindowCovering.Cluster.id,
              'operationalStatus',
              { global: WindowCovering.MovementStatus.Stopped, lift: WindowCovering.MovementStatus.Stopped, tilt: WindowCovering.MovementStatus.Stopped },
              this.coverLift.log,
            );
            this.coverLift?.log.info(`Set cover current and target positionLiftPercent100ths to ${position} and operationalStatus to Stopped`);
          }
        },
        60 * 1000 + 400,
      );
    }

    // Set lock to Locked
    await this.lock?.setAttribute(DoorLock.Cluster.id, 'lockState', DoorLock.LockState.Locked, this.lock.log);
    this.lock?.log.info('Set lock initial lockState to Locked');
    if (this.config.useInterval) {
      // Toggle lock every minute
      this.lockInterval = setInterval(
        async () => {
          const status = this.lock?.getAttribute(DoorLock.Cluster.id, 'lockState', this.lock.log);
          if (isValidNumber(status, DoorLock.LockState.Locked, DoorLock.LockState.Unlocked)) {
            await this.lock?.setAttribute(
              DoorLock.Cluster.id,
              'lockState',
              status === DoorLock.LockState.Locked ? DoorLock.LockState.Unlocked : DoorLock.LockState.Locked,
              this.lock.log,
            );
            this.lock?.log.info(`Set lock lockState to ${status === DoorLock.LockState.Locked ? 'Locked' : 'Unlocked'}`);
          }
        },
        60 * 1000 + 500,
      );
    }

    // Set local to 16°C
    await this.thermoAuto?.setAttribute(ThermostatCluster.id, 'localTemperature', 16 * 100, this.thermoAuto.log);
    await this.thermoAuto?.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Auto, this.thermoAuto.log);

    // istanbul ignore next if cause no runningState attribute before 3.3.3
    if (this.thermoAuto?.hasAttributeServer(ThermostatCluster.id, 'thermostatRunningState')) {
      const runningState = this.thermoAuto?.getAttribute(ThermostatCluster.id, 'thermostatRunningState', this.thermoAuto.log);
      this.thermoAuto?.setAttribute(ThermostatCluster.id, 'thermostatRunningState', { ...runningState, heat: true }, this.thermoAuto.log);
    }

    this.thermoAuto?.log.info('Set thermostat initial localTemperature to 16°C, mode Auto and heat runningState to true');
    const temperature = this.thermoAuto?.getChildEndpointByName('Temperature');
    await temperature?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 16 * 100, this.thermoAuto?.log);
    const humidity = this.thermoAuto?.getChildEndpointByName('Humidity');
    await humidity?.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', 50 * 100, this.thermoAuto?.log);
    const flow = this.thermoAuto?.getChildEndpointByName('Flow');
    await flow?.setAttribute(FlowMeasurement.Cluster.id, 'measuredValue', 10, this.thermoAuto?.log);
    this.thermoAuto?.log.info('Set thermostat ext temperature to 16°C, ext humidity to 50% and ext valve flow to 10');

    await this.thermoAutoOccupancy?.setAttribute(ThermostatCluster.id, 'occupancy', { occupied: true }, this.thermoAutoOccupancy.log);
    await this.thermoAutoOccupancy?.setAttribute(ThermostatCluster.id, 'systemMode', Thermostat.SystemMode.Auto, this.thermoAutoOccupancy.log);
    this.thermoAutoOccupancy?.log.info('Set thermostat occupancy to true and mode Auto');

    if (this.config.useInterval) {
      // Increment localTemperature every minute
      this.thermoInterval = setInterval(
        async () => {
          let temperature = this.thermoAuto?.getAttribute(ThermostatCluster.id, 'localTemperature', this.thermoAuto.log);
          if (isValidNumber(temperature, 1600, 2400)) {
            temperature = temperature + 100 > 2400 ? 1600 : temperature + 100;
            await this.thermoAuto?.setAttribute(ThermostatCluster.id, 'localTemperature', temperature, this.thermoAuto.log);

            await this.thermoHeat?.setAttribute(ThermostatCluster.id, 'localTemperature', temperature, this.thermoHeat.log);
            const tempIn = this.thermoHeat?.getChildEndpointByName('TemperatureIN');
            await tempIn?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', temperature - 50, this.thermoHeat?.log);
            const tempOut = this.thermoHeat?.getChildEndpointByName('TemperatureOUT');
            await tempOut?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', temperature - 400, this.thermoHeat?.log);

            await this.thermoCool?.setAttribute(ThermostatCluster.id, 'localTemperature', temperature, this.thermoCool.log);
            const temp = this.thermoCool?.getChildEndpointByName('Temperature');
            await temp?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', temperature, this.thermoCool?.log);
            const humidity = this.thermoCool?.getChildEndpointByName('Humidity');
            await humidity?.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', 50 * 100, this.thermoCool?.log);
            const flow = this.thermoCool?.getChildEndpointByName('Flow');
            await flow?.setAttribute(FlowMeasurement.Cluster.id, 'measuredValue', 10, this.thermoCool?.log);
            this.thermoAuto?.log.info(`Set thermostat localTemperature to ${temperature / 100}°C`);
            this.thermoHeat?.log.info(`Set thermostat localTemperature to ${temperature / 100}°C`);
            this.thermoCool?.log.info(`Set thermostat localTemperature to ${temperature / 100}°C`);
          }

          let temperatureOccupancy = this.thermoAutoOccupancy?.getAttribute(ThermostatCluster.id, 'localTemperature', this.thermoAutoOccupancy.log);
          if (isValidNumber(temperatureOccupancy, 1600, 2400)) {
            // Change temperature between 16°C and 24°C
            temperatureOccupancy = temperatureOccupancy + 100 > 2400 ? 1600 : temperatureOccupancy + 100;
            await this.thermoAutoOccupancy?.setAttribute(ThermostatCluster.id, 'localTemperature', temperatureOccupancy, this.thermoAutoOccupancy.log);
            await this.thermoAutoOccupancy?.setAttribute(ThermostatCluster.id, 'outdoorTemperature', temperatureOccupancy + 100, this.thermoAutoOccupancy.log);
            // Toggle occupancy
            const occupancyValue = this.thermoAutoOccupancy?.getAttribute(Thermostat.Cluster.id, 'occupancy', this.thermoAutoOccupancy.log) as { occupied: boolean };
            if (isValidObject(occupancyValue, 1)) {
              occupancyValue.occupied = !occupancyValue.occupied;
              await this.thermoAutoOccupancy?.setAttribute(Thermostat.Cluster.id, 'occupancy', occupancyValue, this.thermoAutoOccupancy.log);
              this.thermoAutoOccupancy?.log.info(`Set thermostat occupancy to ${occupancyValue.occupied}`);
            }
          }

          // istanbul ignore next if cause no runningState attribute before 3.3.3
          if (this.thermoAuto?.hasAttributeServer(ThermostatCluster.id, 'thermostatRunningState')) {
            const runningState = this.thermoAuto?.getAttribute(ThermostatCluster.id, 'thermostatRunningState', this.thermoAuto.log);
            runningState.heat = !runningState?.heat;
            runningState.cool = !runningState?.cool;
            this.thermoAuto?.setAttribute(ThermostatCluster.id, 'thermostatRunningState', runningState, this.thermoAuto.log);
          }
        },
        60 * 1000 + 600,
      );
    }

    // Set airConditioner to on
    await this.airConditioner?.setAttribute(OnOff.Cluster.id, 'onOff', true, this.airConditioner.log);
    await this.airConditioner?.setAttribute(ThermostatCluster.id, 'localTemperature', 2000, this.airConditioner.log);
    if (this.config.useInterval) {
      // Increment airConditioner localTemperature every minute
      this.airConditionerInterval = setInterval(
        async () => {
          let temperature = this.airConditioner?.getAttribute(ThermostatCluster.id, 'localTemperature', this.airConditioner.log);
          if (isValidNumber(temperature, 1600, 2400)) {
            temperature = temperature + 100 > 2400 ? 1600 : temperature + 100;
            await this.airConditioner?.setAttribute(ThermostatCluster.id, 'localTemperature', temperature, this.airConditioner.log);
            await this.airConditioner?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', temperature, this.airConditioner.log);
            await this.airConditioner?.setAttribute(RelativeHumidityMeasurementCluster.id, 'measuredValue', 50 * 100, this.airConditioner.log);
            this.airConditioner?.log.info(`Set airConditioner localTemperature to ${temperature / 100}°C`);
          }
        },
        60 * 1000 + 550,
      );
    }

    // Set fan to auto
    this.fanBase?.log.info('Set fan initial fanMode to Off, percentCurrent and percentSetting to 0');
    await this.fanBase?.setAttribute(FanControl.Cluster.id, 'fanMode', FanControl.FanMode.Off, this.fanBase.log);
    await this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanBase.log);
    await this.fanBase?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanBase.log);
    await this.fanDefault?.setAttribute(FanControl.Cluster.id, 'fanMode', FanControl.FanMode.Auto, this.fanDefault.log);
    await this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanDefault.log);
    await this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanDefault.log);
    await this.fanComplete?.setAttribute(FanControl.Cluster.id, 'fanMode', FanControl.FanMode.Auto, this.fanComplete.log);
    await this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', 0, this.fanComplete.log);
    await this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', 0, this.fanComplete.log);
    if (this.config.useInterval) {
      // Increment fan percentCurrent every minute
      this.fanInterval = setInterval(
        async () => {
          let mode = this.fanBase?.getAttribute(FanControl.Cluster.id, 'fanMode', this.fanBase.log);
          let value = this.fanBase?.getAttribute(FanControl.Cluster.id, 'percentCurrent', this.fanBase.log);
          mode = this.fanDefault?.getAttribute(FanControl.Cluster.id, 'fanMode', this.fanDefault.log);
          value = this.fanDefault?.getAttribute(FanControl.Cluster.id, 'percentCurrent', this.fanDefault.log);
          if (isValidNumber(mode, FanControl.FanMode.Off, FanControl.FanMode.Auto) && mode === FanControl.FanMode.Auto && isValidNumber(value, 0, 100)) {
            value = value + 10 >= 100 ? 0 : value + 10;
            await this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentCurrent', value, this.fanDefault.log);
            await this.fanDefault?.setAttribute(FanControl.Cluster.id, 'percentSetting', value, this.fanDefault.log);
            this.fanDefault?.log.info(`Set fan percentCurrent and percentSetting to ${value}`);
          }
          mode = this.fanComplete?.getAttribute(FanControl.Cluster.id, 'fanMode', this.fanComplete.log);
          value = this.fanComplete?.getAttribute(FanControl.Cluster.id, 'percentCurrent', this.fanComplete.log);
          if (isValidNumber(mode, FanControl.FanMode.Off, FanControl.FanMode.Auto) && mode === FanControl.FanMode.Auto && isValidNumber(value, 0, 100)) {
            value = value + 10 >= 100 ? 0 : value + 10;
            await this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentCurrent', value, this.fanComplete.log);
            await this.fanComplete?.setAttribute(FanControl.Cluster.id, 'percentSetting', value, this.fanComplete.log);
            this.fanComplete?.log.info(`Set fan percentCurrent and percentSetting to ${value}`);
          }
        },
        60 * 1000 + 700,
      );
    }

    // Set waterLeak to false
    await this.waterLeak?.setAttribute(BooleanState.Cluster.id, 'stateValue', false, this.waterLeak.log);
    if (this.config.useInterval) {
      // Toggle waterLeak every minute
      this.waterLeakInterval = setInterval(
        async () => {
          let value = this.waterLeak?.getAttribute(BooleanState.Cluster.id, 'stateValue', this.waterLeak.log);
          if (isValidBoolean(value)) {
            value = !value;
            await this.waterLeak?.setAttribute(BooleanState.Cluster.id, 'stateValue', value, this.waterLeak.log);
            this.waterLeak?.log.info(`Set waterLeak stateValue to ${value}`);
          }
        },
        60 * 1000 + 800,
      );
    }

    // Set waterFreeze to false
    await this.waterFreeze?.setAttribute(BooleanState.Cluster.id, 'stateValue', false, this.waterFreeze.log);
    if (this.config.useInterval) {
      // Toggle waterFreeze every minute
      this.waterFreezeInterval = setInterval(
        async () => {
          let value = this.waterFreeze?.getAttribute(BooleanState.Cluster.id, 'stateValue', this.waterFreeze.log);
          if (isValidBoolean(value)) {
            value = !value;
            await this.waterFreeze?.setAttribute(BooleanState.Cluster.id, 'stateValue', value, this.waterFreeze.log);
            this.waterFreeze?.log.info(`Set waterFreeze stateValue to ${value}`);
          }
        },
        60 * 1000 + 900,
      );
    }

    // Set rain to false
    await this.rain?.setAttribute(BooleanState.Cluster.id, 'stateValue', false, this.rain.log);
    if (this.config.useInterval) {
      // Toggle rain every minute
      this.rainInterval = setInterval(
        async () => {
          let value = this.rain?.getAttribute(BooleanState.Cluster.id, 'stateValue', this.rain.log);
          if (isValidBoolean(value)) {
            value = !value;
            await this.rain?.setAttribute(BooleanState.Cluster.id, 'stateValue', value, this.rain.log);
            this.rain?.log.info(`Set rain stateValue to ${value}`);
          }
        },
        60 * 1000 + 1000,
      );
    }

    // Set smoke to Normal
    await this.smokeCo?.setAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', SmokeCoAlarm.AlarmState.Normal, this.smokeCo.log);
    await this.smokeCo?.setAttribute(SmokeCoAlarm.Cluster.id, 'coState', SmokeCoAlarm.AlarmState.Normal, this.smokeCo.log);
    await this.smokeOnly?.setAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', SmokeCoAlarm.AlarmState.Normal, this.smokeOnly.log);
    await this.coOnly?.setAttribute(SmokeCoAlarm.Cluster.id, 'coState', SmokeCoAlarm.AlarmState.Normal, this.coOnly.log);
    if (this.config.useInterval) {
      // Toggle smoke every minute
      this.smokeInterval = setInterval(
        async () => {
          let value = this.smokeCo?.getAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', this.smokeCo.log);
          if (isValidNumber(value, SmokeCoAlarm.AlarmState.Normal, SmokeCoAlarm.AlarmState.Critical)) {
            value = value === SmokeCoAlarm.AlarmState.Normal ? SmokeCoAlarm.AlarmState.Critical : SmokeCoAlarm.AlarmState.Normal;
            await this.smokeCo?.setAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', value, this.smokeCo.log);
            await this.smokeCo?.setAttribute(SmokeCoAlarm.Cluster.id, 'coState', value, this.smokeCo.log);
            await this.smokeOnly?.setAttribute(SmokeCoAlarm.Cluster.id, 'smokeState', value, this.smokeOnly.log);
            await this.coOnly?.setAttribute(SmokeCoAlarm.Cluster.id, 'coState', value, this.coOnly.log);
            this.smokeCo?.log.info(`Set smoke smokeState and coState to ${value}`);
          }
        },
        60 * 1000 + 1100,
      );
    }

    // Set air quality to Normal
    await this.airQuality?.setAttribute(AirQuality.Cluster.id, 'airQuality', AirQuality.AirQualityEnum.Good, this.airQuality.log);
    await this.airQuality?.setAttribute(TemperatureMeasurement.Cluster.id, 'measuredValue', 2150, this.airQuality.log);
    await this.airQuality?.setAttribute(RelativeHumidityMeasurement.Cluster.id, 'measuredValue', 5500, this.airQuality.log);
    await this.airQuality?.setAttribute(CarbonMonoxideConcentrationMeasurement.Cluster.id, 'measuredValue', 10, this.airQuality.log);
    await this.airQuality?.setAttribute(CarbonDioxideConcentrationMeasurement.Cluster.id, 'measuredValue', 400, this.airQuality.log);
    await this.airQuality?.setAttribute(NitrogenDioxideConcentrationMeasurement.Cluster.id, 'measuredValue', 1, this.airQuality.log);
    await this.airQuality?.setAttribute(OzoneConcentrationMeasurement.Cluster.id, 'measuredValue', 1, this.airQuality.log);
    await this.airQuality?.setAttribute(FormaldehydeConcentrationMeasurement.Cluster.id, 'measuredValue', 1, this.airQuality.log);
    await this.airQuality?.setAttribute(Pm1ConcentrationMeasurement.Cluster.id, 'measuredValue', 100, this.airQuality.log);
    await this.airQuality?.setAttribute(Pm25ConcentrationMeasurement.Cluster.id, 'measuredValue', 100, this.airQuality.log);
    await this.airQuality?.setAttribute(Pm10ConcentrationMeasurement.Cluster.id, 'measuredValue', 100, this.airQuality.log);
    await this.airQuality?.setAttribute(RadonConcentrationMeasurement.Cluster.id, 'measuredValue', 100, this.airQuality.log);
    await this.airQuality?.setAttribute(TotalVolatileOrganicCompoundsConcentrationMeasurement.Cluster.id, 'measuredValue', 100, this.airQuality.log);

    if (this.config.useInterval) {
      // Toggle air quality every minute
      this.airQualityInterval = setInterval(
        async () => {
          let value = this.airQuality?.getAttribute(AirQuality.Cluster.id, 'airQuality', this.airQuality?.log);
          if (isValidNumber(value, AirQuality.AirQualityEnum.Good, AirQuality.AirQualityEnum.ExtremelyPoor)) {
            value = value >= AirQuality.AirQualityEnum.ExtremelyPoor ? AirQuality.AirQualityEnum.Good : value + 1;
            await this.airQuality?.setAttribute(AirQuality.Cluster.id, 'airQuality', value, this.airQuality.log);
            this.airQuality?.log.info(`Set air quality to ${value}`);
          }
        },
        60 * 1000 + 1100,
      );
    }

    if (this.config.useInterval) {
      // Trigger the switches every minute
      this.genericSwitchLastEvent = 'Release';
      this.genericSwitchInterval = setInterval(
        async () => {
          // console.error('Entering generic switch interval triggered', this.genericSwitchLastEvent);
          if (this.genericSwitchLastEvent === 'Release') {
            this.genericSwitchLastEvent = 'Single';
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch1')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch2')?.triggerSwitchEvent('Double', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch3')?.triggerSwitchEvent('Long', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch4')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch5')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch6')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
          } else if (this.genericSwitchLastEvent === 'Single') {
            this.genericSwitchLastEvent = 'Double';
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch1')?.triggerSwitchEvent('Double', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch2')?.triggerSwitchEvent('Long', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch3')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
          } else if (this.genericSwitchLastEvent === 'Double') {
            this.genericSwitchLastEvent = 'Long';
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch1')?.triggerSwitchEvent('Long', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch2')?.triggerSwitchEvent('Single', this.momentarySwitch?.log);
            await this.momentarySwitch?.getChildEndpointByName('Momentaryswitch3')?.triggerSwitchEvent('Double', this.momentarySwitch?.log);
          } else if (this.genericSwitchLastEvent === 'Long') {
            this.genericSwitchLastEvent = 'Press';
            await this.latchingSwitch?.triggerSwitchEvent('Press', this.latchingSwitch?.log);
          } else if (this.genericSwitchLastEvent === 'Press') {
            this.genericSwitchLastEvent = 'Release';
            await this.latchingSwitch?.triggerSwitchEvent('Release', this.latchingSwitch?.log);
          }
          // console.error('Exiting generic switch interval triggered', this.genericSwitchLastEvent);
        },
        60 * 1000 + 1900,
      );
    }
  }

  override async onShutdown(reason?: string) {
    clearInterval(this.phaseInterval);
    clearInterval(this.sensorInterval);
    clearInterval(this.switchInterval);
    clearInterval(this.lightInterval);
    clearInterval(this.outletInterval);
    clearInterval(this.coverInterval);
    clearInterval(this.lockInterval);
    clearInterval(this.thermoInterval);
    clearInterval(this.fanInterval);
    clearInterval(this.waterLeakInterval);
    clearInterval(this.waterFreezeInterval);
    clearInterval(this.rainInterval);
    clearInterval(this.smokeInterval);
    clearInterval(this.airQualityInterval);
    clearInterval(this.airConditionerInterval);
    clearInterval(this.genericSwitchInterval);
    await super.onShutdown(reason);
    this.log.info('onShutdown called with reason:', reason ?? 'none');
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices(500);
  }

  async addDevice(device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint | undefined> {
    if (!device.serialNumber || !device.deviceName) return;
    this.setSelectDevice(device.serialNumber, device.deviceName, undefined, 'hub');
    if (this.validateDevice(device.deviceName)) {
      device.softwareVersion = parseInt(this.version.replace(/\D/g, ''));
      device.softwareVersionString = this.version === '' ? 'Unknown' : this.version;
      device.hardwareVersion = parseInt(this.matterbridge.matterbridgeVersion.replace(/\D/g, ''));
      device.hardwareVersionString = this.matterbridge.matterbridgeVersion;
      device.softwareVersion = isValidNumber(device.softwareVersion, 0, UINT32_MAX) ? device.softwareVersion : undefined;
      device.softwareVersionString = isValidString(device.softwareVersionString) ? device.softwareVersionString.slice(0, 64) : undefined;
      device.hardwareVersion = isValidNumber(device.hardwareVersion, 0, UINT16_MAX) ? device.hardwareVersion : undefined;
      device.hardwareVersionString = isValidString(device.hardwareVersionString) ? device.hardwareVersionString.slice(0, 64) : undefined;
      const options = device.getClusterServerOptions(BridgedDeviceBasicInformation.Cluster.id);
      if (options) {
        options.softwareVersion = device.softwareVersion || 1;
        options.softwareVersionString = device.softwareVersionString || '1.0.0';
        options.hardwareVersion = device.hardwareVersion || 1;
        options.hardwareVersionString = device.hardwareVersionString || '1.0.0';
      }
      // We need to add bridgedNode device type and BridgedDeviceBasicInformation cluster for single class devices that doesn't add it in childbridge mode.
      if (device.mode === undefined && !device.deviceTypes.has(bridgedNode.code)) {
        device.deviceTypes.set(bridgedNode.code, bridgedNode);
        const options = device.getClusterServerOptions(Descriptor.Cluster.id);
        if (options) {
          const deviceTypeList = options.deviceTypeList as { deviceType: number; revision: number }[];
          if (!deviceTypeList.find((dt) => dt.deviceType === bridgedNode.code)) {
            deviceTypeList.push({ deviceType: bridgedNode.code, revision: bridgedNode.revision });
          }
        }
        device.createDefaultBridgedDeviceBasicInformationClusterServer(
          device.deviceName,
          device.serialNumber,
          device.vendorId,
          device.vendorName,
          device.productName,
          device.softwareVersion,
          device.softwareVersionString,
          device.hardwareVersion,
          device.hardwareVersionString,
        );
      }

      await this.registerDevice(device);
      this.bridgedDevices.set(device.deviceName, device);
      return device;
    } else {
      return undefined;
    }
  }
}
