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
import { Device, RoborockAuthenticateApi, RoborockIoTApi } from './roborockCommunication/index.js';

export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  robot: RoborockVacuumCleaner | undefined;
  rvcInterval: NodeJS.Timeout | undefined;
  roborockService: RoborockService | undefined;
  clientManager: ClientManager;
  platformRunner: PlatformRunner | undefined;
  serialNumberAndDuidMapping: Map<string, string>;
  devices: Map<string, Device>;
  serialNumber: string | undefined;
  isReadyToConfigurate = false;

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

    this.clientManager = new ClientManager(this.log);
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
    axiosInstance.interceptors.request.use((request: any) => {
      self.log.debug('Axios Request:', {
        method: request.method,
        url: request.url,
        data: request.data,
        headers: request.headers,
      });
      return request;
    });

    axiosInstance.interceptors.response.use((response: any) => {
      self.log.debug('Axios Response:', {
        status: response.status,
        data: response.data,
        headers: response.headers,
        url: response.config.url,
      });
      return response;
    });

    this.platformRunner = new PlatformRunner(this);

    this.roborockService = new RoborockService(
      () => new RoborockAuthenticateApi(this.log, axiosInstance),
      (logger, ud) => new RoborockIoTApi(ud, logger),
      (this.config.refreshInterval as number) ?? 60,
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

    this.isReadyToConfigurate = true;
    this.log.notice('onStart finished');
  }

  override async onConfigure() {
    await super.onConfigure();
    this.log.notice('onConfigure started');

    // Verify that the config is correct
    if (this.config.username === undefined || this.config.password === undefined) {
      this.log.error('"username" and "password" are required in the config');
      return;
    }

    while (!this.isReadyToConfigurate) {
      await this.sleep(1000);
    }

    const self = this;
    await this.onConfigurateDevice();
    this.rvcInterval = setInterval(
      async () => {
        self.platformRunner?.requestHomeData();
      },
      ((this.config.refreshInterval as number) ?? 60) * 1000 + 100,
    );

    this.log.notice('onConfigure finished');
  }

  async onConfigurateDevice(): Promise<void> {
    this.log.info('onConfigurateDevice start');
    if (this.platformRunner === undefined || this.roborockService === undefined) {
      this.log.error('PlatformRunner or RoborockService is undefined');
      return;
    }
    const vacuum = this.devices.get(this.serialNumber as string);
    const username = this.config.username as string;
    if (!vacuum || !username) {
      this.log.error('No supported devices found');
      return;
    }

    const self = this;
    await this.roborockService.initializeMessageClientForLocal(vacuum);

    const roomMap = await this.platformRunner.getRoomMapFromDevice(vacuum);
    const { supportedAreas, defaultSelectedAreas } = getSupportedAreas(vacuum.rooms, roomMap, this.log);
    const { BehaviorClass, behaviorHandler } = configurateBehavior(vacuum.data.model, vacuum.duid, this.roborockService, this.log);

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
        vacuum.pv, //softwareVersionString
        undefined,
        vacuum.fv, //hardwareVersionString
      )
      .createDefaultRvcRunModeClusterServer(getSupportedRunModes(vacuum.data.model))
      .createDefaultRvcOperationalStateClusterServer(getOperationalStates(vacuum.data.model))
      .createDefaultRvcCleanModeClusterServer(getSupportedCleanModes(vacuum.data.model))
      .createDefaultServiceAreaClusterServer(supportedAreas, [], defaultSelectedAreas)
      .createDefaultPowerSourceRechargeableBatteryClusterServer(vacuum.data.batteryLevel ?? 100, getBatteryStatus(vacuum.data.batteryLevel ?? 100), 5900)
      .configurateBehaviorHandler(BehaviorClass, behaviorHandler);

    this.log.info('vacuum:', JSON.stringify(vacuum));

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

    this.log.info('onConfigurateDevice finished');
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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
