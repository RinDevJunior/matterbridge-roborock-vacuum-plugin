import './extensions/index.js';
import { Matterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import * as axios from 'axios';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import RoborockService from './roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import ClientManager from './clientManager.js';
import { isSupportedDevice } from './helper.js';
import { PlatformRunner } from './platformRunner.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { getOperationalStates, getSupportedCleanModes, getSupportedRunModes, getSupportedAreas, getBatteryStatus } from './initialData/index.js';
import { configurateBehavior } from './behaviorFactory.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import RoborockAuthenticateApi from './roborockCommunication/RESTAPI/roborockAuthenticateApi.js';
import RoborockIoTApi from './roborockCommunication/RESTAPI/roborockIoTApi.js';
import Device from './roborockCommunication/Zmodel/device.js';
import UserData from './roborockCommunication/Zmodel/userData.js';

export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  robot: RoborockVacuumCleaner | undefined;
  rvcInterval: NodeJS.Timeout | undefined;
  roborockService: RoborockService | undefined;
  clientManager: ClientManager;
  platformRunner: PlatformRunner | undefined;
  serialNumberAndDuidMapping: Map<string, string>;
  devices: Map<string, Device>;
  serialNumber: string | undefined;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.0.1')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.0.1". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }

    this.log.info('Initializing platform:', this.config.name);
    if (config.whiteList === undefined) config.whiteList = [];
    if (config.blackList === undefined) config.blackList = [];
    if (config.enableRVC === undefined) config.enableRVC = false;

    this.clientManager = new ClientManager();
    this.serialNumberAndDuidMapping = new Map<string, string>();
    this.devices = new Map<string, Device>();
  }

  override async onStart(reason?: string) {
    this.log.notice('onStart called with reason:', reason ?? 'none');
    const self = this;

    // Wait for the platform to start
    await this.ready;
    await this.clearSelect();

    // Verify that the config is correct
    if (this.config.username === undefined || this.config.password === undefined) {
      this.log.error('"username" and "password" are required in the config');
      return;
    }

    // Add request interceptor
    const axiosInstance = axios.default ?? axios;
    axiosInstance.interceptRequestAndResponse(this.log);

    this.platformRunner = new PlatformRunner(this);

    this.roborockService = new RoborockService(
      () => new RoborockAuthenticateApi(this.log, axiosInstance),
      (logger, ud) => new RoborockIoTApi(ud, logger),
      (this.config.refreshInterval as number) ?? 30,
      this.clientManager,
      this.log,
    );

    const username = this.config.username as string;
    const password = this.config.password as string;

    const userData = await this.roborockService.loginWithPassword(username, password);
    this.log.debug('Login successful:', JSON.stringify(userData));

    const devices = await this.roborockService.listDevices(username);
    const vacuum = devices.find((d) => isSupportedDevice(d.data.model));
    if (!vacuum) {
      this.log.error('No supported devices found');
      return;
    }
    await this.roborockService.initializeMessageClient(username, vacuum, userData);
    this.devices.set(vacuum.serialNumber, vacuum);
    this.serialNumber = vacuum.serialNumber;
  }

  override async onConfigure() {
    await super.onConfigure();

    // Verify that the config is correct
    if (this.config.username === undefined || this.config.password === undefined) {
      this.log.error('"username" and "password" are required in the config');
      return;
    }

    const self = this;
    await this.onConfigurateDevice();
    this.rvcInterval = setInterval(
      async () => {
        self.platformRunner?.requestHomeData();
      },
      ((this.config.refreshInterval as number) ?? 60) * 1000 + 100,
    );

    this.log.info('onConfigure called');
  }

  async onConfigurateDevice(): Promise<void> {
    if (this.platformRunner === undefined || this.roborockService === undefined) {
      return;
    }
    const vacuum = this.devices.get(this.serialNumber as string);
    const username = this.config.username as string;
    if (!vacuum || !username) {
      this.log.error('No supported devices found');
      return;
    }

    const self = this;
    const roomMap = await this.platformRunner.getRoomMap(vacuum);

    const { supportedAreas, defaultSelectedAreas } = getSupportedAreas(vacuum.rooms, roomMap, this.log);
    const { behaviorClass, behaviorHandler } = configurateBehavior(vacuum.data.model, vacuum.duid, this.roborockService, this.log);

    this.serialNumberAndDuidMapping.set(vacuum.serialNumber, vacuum.duid);

    // Create a new MatterbridgeEndpoint for the robot vacuum cleaner
    this.robot = new RoborockVacuumCleaner(username, vacuum, true)
      .createDefaultIdentifyClusterServer()
      .createDefaultBasicInformationClusterServer(
        vacuum.name,
        vacuum.serialNumber,
        0xfff1,
        'Roborock',
        0x8000,
        'Matterbridge Roborock Vacuum Cleaner',
        undefined,
        vacuum.fv, //softwareVersionString
        undefined,
        vacuum.fv, //hardwareVersionString
      )
      .createDefaultRvcRunModeClusterServer(getSupportedRunModes(vacuum.data.model))
      .createDefaultRvcOperationalStateClusterServer(getOperationalStates(vacuum.data.model))
      .createDefaultRvcCleanModeClusterServer(getSupportedCleanModes(vacuum.data.model))
      .createDefaultServiceAreaClusterServer(supportedAreas, [], defaultSelectedAreas)
      .createDefaultPowerSourceRechargeableBatteryClusterServer(vacuum.data.batteryLevel ?? 100, getBatteryStatus(vacuum.data.batteryLevel ?? 100), 5900)
      .configurateBehaviorHandler(behaviorClass, behaviorHandler);

    this.robot.addCommandHandler('identify', async ({ request: { identifyTime } }) => {
      this.log.info(`Command identify called identifyTime:${identifyTime}`);
      behaviorHandler.executeCommand('PlaySoundToLocate', identifyTime as number);
    });

    this.setSelectDevice(this.robot.serialNumber ?? '', this.robot.deviceName ?? '', undefined, 'hub');
    if (this.validateDevice(this.robot.deviceName ?? '')) {
      await this.registerDevice(this.robot);
    }

    this.roborockService.setDeviceNotify(async function (messageSource: NotifyMessageTypes, homeData: any) {
      await self.platformRunner?.updateRobot(messageSource, homeData);
    });

    await this.roborockService.activateDeviceNotify(this.robot.device);
    await self.platformRunner?.requestHomeData();
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);
    this.log.notice('onShutdown called with reason:', reason ?? 'none');
    this.rvcInterval && clearInterval(this.rvcInterval);
    if (this.roborockService) this.roborockService.stopService();
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices(500);
  }

  override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
    this.log.notice(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
    this.log.logLevel = logLevel;
    return Promise.resolve();
  }
}
