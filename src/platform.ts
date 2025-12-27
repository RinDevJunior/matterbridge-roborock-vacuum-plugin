import { PlatformMatterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import * as axios from 'axios';
import crypto from 'node:crypto';
import { AnsiLogger, debugStringify, LogLevel } from 'matterbridge/logger';
import RoborockService from './roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import ClientManager from './clientManager.js';
import { getRoomMapFromDevice, isSupportedDevice } from './helper.js';
import { PlatformRunner } from './platformRunner.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { configurateBehavior } from './behaviorFactory.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { Device, RoborockAuthenticateApi, RoborockIoTApi, UserData, AuthenticateFlowState } from './roborockCommunication/index.js';
import { getSupportedAreas, getSupportedScenes } from './initialData/index.js';
import { CleanModeSettings, createDefaultExperimentalFeatureSetting, ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import NodePersist from 'node-persist';
import Path from 'node:path';
import { Room } from './roborockCommunication/Zmodel/room.js';

export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  robots: Map<string, RoborockVacuumCleaner> = new Map<string, RoborockVacuumCleaner>();
  rvcInterval: NodeJS.Timeout | undefined;
  roborockService: RoborockService | undefined;
  clientManager: ClientManager;
  platformRunner: PlatformRunner | undefined;
  devices: Map<string, Device> = new Map<string, Device>();
  cleanModeSettings: CleanModeSettings | undefined;
  enableExperimentalFeature: ExperimentalFeatureSetting | undefined;
  persist: NodePersist.LocalStorage;
  rrHomeId: number | undefined;

  constructor(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig) {
    super(matterbridge, log, config);

    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion('3.3.6')) {
      throw new Error(
        `This plugin requires Matterbridge version >= "3.3.6". Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }
    this.log.info('Initializing platform:', this.config.name);
    if (config.whiteList === undefined) config.whiteList = [];
    if (config.blackList === undefined) config.blackList = [];
    if (config.enableExperimental === undefined) config.enableExperimental = createDefaultExperimentalFeatureSetting() as ExperimentalFeatureSetting;

    // Create storage for this plugin (initialised in onStart)
    const persistDir = Path.join(this.matterbridge.matterbridgePluginDirectory, PLUGIN_NAME, 'persist');
    this.persist = NodePersist.create({ dir: persistDir });

    this.clientManager = new ClientManager(this.log);
    this.devices = new Map<string, Device>();
  }

  override async onStart(reason?: string) {
    this.log.notice('onStart called with reason:', reason ?? 'none');

    // Wait for the platform to start
    await this.ready;
    await this.clearSelect();

    await this.persist.init();

    // Verify that the config is correct
    if (this.config.username === undefined) {
      this.log.error('"username" (email address) is required in the config');
      return;
    }

    const axiosInstance = axios.default ?? axios;

    this.enableExperimentalFeature = this.config.enableExperimental as ExperimentalFeatureSetting;
    // Disable multiple map for more investigation
    this.enableExperimentalFeature.advancedFeature.enableMultipleMap = false;

    if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature?.cleanModeSettings?.enableCleanModeMapping) {
      this.cleanModeSettings = this.enableExperimentalFeature.cleanModeSettings as CleanModeSettings;
      this.log.notice(`Experimental Feature has been enable`);
      this.log.notice(`cleanModeSettings ${debugStringify(this.cleanModeSettings)}`);
    }

    this.platformRunner = new PlatformRunner(this);

    // Load or generate deviceId for consistent authentication
    let deviceId = (await this.persist.getItem('deviceId')) as string | undefined;
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      await this.persist.setItem('deviceId', deviceId);
      this.log.debug('Generated new deviceId:', deviceId);
    } else {
      this.log.debug('Using cached deviceId:', deviceId);
    }

    this.roborockService = new RoborockService(
      () => new RoborockAuthenticateApi(this.log, axiosInstance, deviceId),
      (logger, ud) => new RoborockIoTApi(ud, logger),
      (this.config.refreshInterval as number) ?? 60,
      this.clientManager,
      this.log,
    );

    const username = this.config.username as string;
    const verificationCode = this.config.verificationCode as string | undefined;

    // Authenticate using 2FA flow
    let userData: UserData | undefined;
    try {
      userData = await this.authenticate2FA(username, verificationCode);
    } catch (error) {
      this.log.error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    if (!userData) {
      // Code was requested, waiting for user to enter it in config
      return;
    }

    this.log.debug('Initializing - userData:', debugStringify(userData));
    const devices = await this.roborockService.listDevices(username);
    this.log.notice('Initializing - devices: ', debugStringify(devices));

    let vacuums: Device[] = [];
    if ((this.config.whiteList as string[]).length > 0) {
      const whiteList = (this.config.whiteList ?? []) as string[];
      for (const item of whiteList) {
        const duid = item.split('-')[1].trim();
        const vacuum = devices.find((d) => d.duid === duid);
        if (vacuum) {
          vacuums.push(vacuum);
        }
      }
    } else {
      vacuums = devices.filter((d) => isSupportedDevice(d.data.model));
    }

    if (vacuums.length === 0) {
      this.log.error('Initializing: No device found');
      return;
    }

    if (!this.enableExperimentalFeature?.enableExperimentalFeature || !this.enableExperimentalFeature?.advancedFeature?.enableServerMode) {
      vacuums = [vacuums[0]]; // If server mode is not enabled, only use the first vacuum
    }
    // else {
    //   const cloned = JSON.parse(JSON.stringify(vacuums[0])) as Device;
    //   cloned.name = `${cloned.name} Clone`;
    //   cloned.serialNumber = `${cloned.serialNumber}-clone`;

    //   vacuums = [...vacuums, cloned]; // If server mode is enabled, add the first vacuum again to ensure it is always included
    // }

    // this.log.error('Initializing - vacuums: ', debugStringify(vacuums));

    for (const vacuum of vacuums) {
      await this.roborockService.initializeMessageClient(username, vacuum, userData);
      this.devices.set(vacuum.serialNumber, vacuum);
    }

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

    const username = this.config.username as string;
    if (this.devices.size === 0 || !username) {
      this.log.error('Initializing: No supported devices found');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    const configurateSuccess = new Map<string, boolean>();

    for (const vacuum of this.devices.values()) {
      const success = await this.configurateDevice(vacuum);
      configurateSuccess.set(vacuum.duid, success);
      if (success) {
        this.rrHomeId = vacuum.rrHomeId;
      }
    }

    this.roborockService.setDeviceNotify(async function (messageSource: NotifyMessageTypes, homeData: unknown) {
      await self.platformRunner?.updateRobot(messageSource, homeData);
    });

    for (const [duid, robot] of this.robots.entries()) {
      if (!configurateSuccess.get(duid)) {
        continue;
      }
      this.roborockService.activateDeviceNotify(robot.device);
    }

    await this.platformRunner?.requestHomeData();

    this.log.info('onConfigurateDevice finished');
  }

  // Running in loop to configurate devices
  private async configurateDevice(vacuum: Device): Promise<boolean> {
    const username = this.config.username as string;

    if (this.platformRunner === undefined || this.roborockService === undefined) {
      this.log.error('Initializing: PlatformRunner or RoborockService is undefined');
      return false;
    }

    const connectedToLocalNetwork = await this.roborockService.initializeMessageClientForLocal(vacuum);

    if (!connectedToLocalNetwork) {
      this.log.error(`Failed to connect to local network for device: ${vacuum.name} (${vacuum.duid})`);
      return false;
    }

    if (vacuum.rooms === undefined || vacuum.rooms.length === 0) {
      this.log.notice(`Fetching map information for device: ${vacuum.name} (${vacuum.duid}) to get rooms`);
      const map_info = await this.roborockService.getMapInformation(vacuum.duid);
      const rooms = map_info?.allRooms ?? [];
      vacuum.rooms = rooms.map((room) => ({ id: room.globalId, name: room.displayName }) as Room);
    }

    const roomMap = await getRoomMapFromDevice(vacuum, this);

    this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));

    const behaviorHandler = configurateBehavior(
      vacuum.data.model,
      vacuum.duid,
      this.roborockService,
      this.cleanModeSettings,
      this.enableExperimentalFeature?.advancedFeature?.forceRunAtDefault ?? false,
      this.log,
    );

    const enableMultipleMap = this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature.advancedFeature?.enableMultipleMap;

    const { supportedAreas, roomIndexMap } = getSupportedAreas(vacuum.rooms, roomMap, enableMultipleMap, this.log);
    this.roborockService.setSupportedAreas(vacuum.duid, supportedAreas);
    this.roborockService.setSupportedAreaIndexMap(vacuum.duid, roomIndexMap);

    let routineAsRoom: ServiceArea.Area[] = [];
    if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature.advancedFeature?.showRoutinesAsRoom) {
      routineAsRoom = getSupportedScenes(vacuum.scenes ?? [], this.log);
      this.roborockService.setSupportedScenes(vacuum.duid, routineAsRoom);
    }

    const robot = new RoborockVacuumCleaner(username, vacuum, roomMap, routineAsRoom, this.enableExperimentalFeature, this.log);
    robot.configurateHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));

    this.setSelectDevice(robot.serialNumber ?? '', robot.deviceName ?? '', undefined, 'hub');
    if (this.validateDevice(robot.deviceName ?? '')) {
      await this.registerDevice(robot);
    }

    this.robots.set(robot.serialNumber ?? '', robot);

    return true;
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

  /**
   * Authenticate using 2FA verification code flow
   * @param username - The user's email address
   * @param verificationCode - The verification code from config (if provided)
   * @returns UserData on successful authentication, undefined if waiting for code
   */
  private async authenticate2FA(username: string, verificationCode: string | undefined): Promise<UserData | undefined> {
    if (!this.roborockService) {
      throw new Error('RoborockService is not initialized');
    }

    if (!this.enableExperimentalFeature?.advancedFeature?.alwaysExecuteAuthentication) {
      const savedUserData = (await this.persist.getItem('userData')) as UserData | undefined;
      if (savedUserData) {
        this.log.debug('Found saved userData, attempting to use cached token');
        try {
          const userData = await this.roborockService.loginWithCachedToken(username, savedUserData);
          this.log.notice('Successfully authenticated with cached token');
          return userData;
        } catch (error) {
          this.log.warn(`Cached token invalid or expired: ${error instanceof Error ? error.message : String(error)}`);
          await this.persist.removeItem('userData');
          // Continue to request new code
        }
      }
    }

    if (!verificationCode || verificationCode.trim() === '') {
      const authState = (await this.persist.getItem('authenticateFlowState')) as AuthenticateFlowState | undefined;
      const now = Date.now();
      const RATE_LIMIT_MS = 60000; // 1 minute between code requests

      if (authState?.codeRequestedAt && now - authState.codeRequestedAt < RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((RATE_LIMIT_MS - (now - authState.codeRequestedAt)) / 1000);
        this.log.warn(`Please wait ${waitSeconds} seconds before requesting another code.`);
        this.log.notice('============================================');
        this.log.notice('ACTION REQUIRED: Enter verification code');
        this.log.notice(`A verification code was previously sent to: ${username}`);
        this.log.notice('Enter the 6-digit code in the plugin configuration');
        this.log.notice('under the "verificationCode" field, then restart the plugin.');
        this.log.notice('============================================');
        return undefined;
      }

      try {
        this.log.notice(`Requesting verification code for: ${username}`);
        await this.roborockService.requestVerificationCode(username);

        await this.persist.setItem('authenticateFlowState', {
          email: username,
          codeRequestedAt: now,
        } as AuthenticateFlowState);

        this.log.notice('============================================');
        this.log.notice('ACTION REQUIRED: Enter verification code');
        this.log.notice(`A verification code has been sent to: ${username}`);
        this.log.notice('Enter the 6-digit code in the plugin configuration');
        this.log.notice('under the "verificationCode" field, then restart the plugin.');
        this.log.notice('============================================');
      } catch (error) {
        this.log.error(`Failed to request verification code: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }

      return undefined;
    }

    this.log.notice('Attempting login with verification code...');

    const userData = await this.roborockService.loginWithVerificationCode(username, verificationCode.trim(), async (data: UserData) => {
      await this.persist.setItem('userData', data);
      await this.persist.removeItem('authenticateFlowState');
    });

    this.log.notice('Authentication successful!');
    return userData;
  }
}
