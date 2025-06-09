import { Matterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import * as axios from 'axios';
import { AnsiLogger, debugStringify, LogLevel } from 'matterbridge/logger';
import RoborockService from './roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import ClientManager from './clientManager.js';
import { isSupportedDevice } from './helper.js';
import { PlatformRunner } from './platformRunner.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { configurateBehavior } from './behaviorFactory.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { Device, RoborockAuthenticateApi, RoborockIoTApi } from './roborockCommunication/index.js';
import { getSupportedAreas, getSupportedScenes } from './initialData/index.js';
import { CleanModeSettings, ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';
import { ServiceArea } from 'matterbridge/matter/clusters';

export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  robot: RoborockVacuumCleaner | undefined;
  rvcInterval: NodeJS.Timeout | undefined;
  roborockService: RoborockService | undefined;
  clientManager: ClientManager;
  platformRunner: PlatformRunner | undefined;
  devices: Map<string, Device>;
  serialNumber: string | undefined;
  cleanModeSettings: CleanModeSettings | undefined;
  enableExperimentalFeature: ExperimentalFeatureSetting | undefined;

  constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.0.5')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.0.5". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }
    this.log.info('Initializing platform:', this.config.name);
    if (config.whiteList === undefined) config.whiteList = [];
    if (config.blackList === undefined) config.blackList = [];
    if (config.enableExperimentalFeature === undefined) config.enableExperimentalFeature = false;

    this.clientManager = new ClientManager(this.log);
    this.devices = new Map<string, Device>();
  }

  override async onStart(reason?: string) {
    this.log.notice('onStart called with reason:', reason ?? 'none');

    // Wait for the platform to start
    await this.ready;
    await this.clearSelect();

    // Verify that the config is correct
    if (this.config.username === undefined || this.config.password === undefined) {
      this.log.error('"username" and "password" are required in the config');
      return;
    }

    const axiosInstance = axios.default ?? axios;

    this.enableExperimentalFeature = this.config.enableExperimental as ExperimentalFeatureSetting;
    if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature?.cleanModeSettings?.enableCleanModeMapping) {
      this.cleanModeSettings = this.enableExperimentalFeature.cleanModeSettings as CleanModeSettings;
      this.log.notice(`Experimental Feature has been enable`);
      this.log.notice(`cleanModeSettings ${debugStringify(this.cleanModeSettings)}`);
    }

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
    this.log.debug('Initializing - userData:', debugStringify(userData));
    const devices = await this.roborockService.listDevices(username);
    this.log.notice('Initializing - devices: ', debugStringify(devices));

    let vacuum: Device | undefined = undefined;
    if ((this.config.whiteList as string[]).length > 0) {
      const firstDUID = (this.config.whiteList as string[])[0];
      const duid = firstDUID.split('-')[1];
      vacuum = devices.find((d) => d.duid == duid);
    } else {
      vacuum = devices.find((d) => isSupportedDevice(d.data.model));
    }

    if (!vacuum) {
      this.log.error('Initializing: No device found');
      return;
    }
    await this.roborockService.initializeMessageClient(username, vacuum, userData);
    this.devices.set(vacuum.serialNumber, vacuum);
    this.serialNumber = vacuum.serialNumber;

    await this.onConfigurateDevice();
    this.log.notice('onStart finished');
  }

  override async onConfigure() {
    await super.onConfigure();
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    this.rvcInterval = setInterval(
      async () => {
        self.platformRunner?.requestHomeData();
      },
      ((this.config.refreshInterval as number) ?? 60) * 1000 + 100,
    );
  }

  async onConfigurateDevice(): Promise<void> {
    this.log.info('onConfigurateDevice start');
    if (this.platformRunner === undefined || this.roborockService === undefined) {
      this.log.error('Initializing: PlatformRunner or RoborockService is undefined');
      return;
    }
    const vacuum = this.devices.get(this.serialNumber as string);
    const username = this.config.username as string;
    if (!vacuum || !username) {
      this.log.error('Initializing: No supported devices found');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    await this.roborockService.initializeMessageClientForLocal(vacuum);
    const roomMap = await this.platformRunner.getRoomMapFromDevice(vacuum);

    this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));

    const behaviorHandler = configurateBehavior(
      vacuum.data.model,
      vacuum.duid,
      this.roborockService,
      this.cleanModeSettings,
      this.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false,
      this.log,
    );

    this.roborockService.setSupportedAreas(vacuum.duid, getSupportedAreas(vacuum.rooms, roomMap, this.log));

    let routineAsRoom: ServiceArea.Area[] = [];
    if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature.advancedFeature?.showRoutinesAsRoom) {
      routineAsRoom = getSupportedScenes(vacuum.scenes, this.log);
      this.roborockService.setSupportedScenes(vacuum.duid, routineAsRoom);
    }

    this.robot = new RoborockVacuumCleaner(username, vacuum, roomMap, routineAsRoom, this.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false, this.log);
    this.robot.configurateHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));

    this.setSelectDevice(this.robot.serialNumber ?? '', this.robot.deviceName ?? '', undefined, 'hub');
    if (this.validateDevice(this.robot.deviceName ?? '')) {
      await this.registerDevice(this.robot);
    }

    this.roborockService.setDeviceNotify(async function (messageSource: NotifyMessageTypes, homeData: unknown) {
      await self.platformRunner?.updateRobot(messageSource, homeData);
    });

    await this.roborockService.activateDeviceNotify(this.robot.device);
    await self.platformRunner?.requestHomeData();

    this.log.info('onConfigurateDevice finished');
  }

  override async onShutdown(reason?: string) {
    await super.onShutdown(reason);
    this.log.notice('onShutdown called with reason:', reason ?? 'none');
    if (this.rvcInterval) clearInterval(this.rvcInterval);
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
