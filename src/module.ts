import { PlatformMatterbridge, MatterbridgeDynamicPlatform, PlatformConfig, MatterbridgeEndpoint, bridgedNode } from 'matterbridge';
import * as axios from 'axios';
import crypto from 'node:crypto';
import { AnsiLogger, debugStringify, LogLevel } from 'matterbridge/logger';
import { isValidNumber, isValidString } from 'matterbridge/utils';
import RoborockService from './roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import { ClientManager } from './services/index.js';
import { getRoomMapFromDevice, isSupportedDevice } from './helper.js';
import { PlatformRunner } from './platformRunner.js';
import { RoborockVacuumCleaner } from './rvc.js';
import { configureBehavior } from './behaviorFactory.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import { Room, Device, RoborockAuthenticateApi, RoborockIoTApi, UserData, AuthenticateFlowState } from './roborockCommunication/index.js';
import { getSupportedAreas, getSupportedScenes } from './initialData/index.js';
import { AuthenticationPayload, CleanModeSettings, createDefaultExperimentalFeatureSetting, ExperimentalFeatureSetting } from './model/ExperimentalFeatureSetting.js';
import { BridgedDeviceBasicInformation, Descriptor, ServiceArea } from 'matterbridge/matter/clusters';
import NodePersist from 'node-persist';
import Path from 'node:path';
import { getBaseUrl } from './initialData/regionUrls.js';
import { UINT16_MAX, UINT32_MAX } from 'matterbridge/matter';
import { VERIFICATION_CODE_RATE_LIMIT_MS, DEFAULT_REFRESH_INTERVAL_SECONDS, REFRESH_INTERVAL_BUFFER_MS, UNREGISTER_DEVICES_DELAY_MS } from './constants/index.js';

export type RoborockPluginPlatformConfig = PlatformConfig & {
  whiteList: string[];
  blackList: string[];
  useInterval: boolean;
  refreshInterval: number;
  debug: boolean;
  authentication: AuthenticationPayload;
  enableExperimental: ExperimentalFeatureSetting;
};

export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): RoborockMatterbridgePlatform {
  return new RoborockMatterbridgePlatform(matterbridge, log, config as RoborockPluginPlatformConfig);
}

/**
 * Matterbridge platform for Roborock vacuum cleaners.
 * Handles device discovery, authentication, and Matter protocol integration.
 */
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
  private isStartPluginCompleted = false;

  constructor(
    matterbridge: PlatformMatterbridge,
    log: AnsiLogger,
    override config: RoborockPluginPlatformConfig,
  ) {
    super(matterbridge, log, config);

    const requiredMatterbridgeVersion = '3.4.7';
    // Verify that Matterbridge is the correct version
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion(requiredMatterbridgeVersion)) {
      throw new Error(
        `This plugin requires Matterbridge version >= "${requiredMatterbridgeVersion}".
        Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }
    this.log.info('Initializing platform:', this.config.name);
    if (config.whiteList === undefined) config.whiteList = [];
    if (config.blackList === undefined) config.blackList = [];
    if (config.enableExperimental === undefined) config.enableExperimental = createDefaultExperimentalFeatureSetting();

    // Create storage for this plugin (initialised in onStart)
    const persistDir = Path.join(this.matterbridge.matterbridgePluginDirectory, PLUGIN_NAME, 'persist');
    this.persist = NodePersist.create({ dir: persistDir });
    this.clientManager = new ClientManager(this.log);
    this.devices = new Map<string, Device>();
  }

  public override async onStart(reason?: string) {
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

    // Start device discovery and authentication
    const shouldContinue = await this.startDeviceDiscovery();
    if (!shouldContinue) {
      this.log.error('Device discovery failed to start.');
      this.isStartPluginCompleted = false;
      return;
    }

    await this.onConfigureDevice();

    // Mark startup as complete
    this.log.notice('onStart finished');
    this.isStartPluginCompleted = true;
  }

  public override async onConfigure() {
    this.log.notice('onConfigure called');
    if (!this.isStartPluginCompleted) {
      return;
    }
    await super.onConfigure();

    this.rvcInterval = setInterval(
      async () => {
        try {
          await this.platformRunner?.requestHomeData();
        } catch (error) {
          this.log.error(`requestHomeData (interval) failed: ${error instanceof Error ? error.message : String(error)}`);
        }
      },
      ((this.config.refreshInterval as number) ?? DEFAULT_REFRESH_INTERVAL_SECONDS) * 1000 + REFRESH_INTERVAL_BUFFER_MS,
    );
  }

  public override async onShutdown(reason?: string) {
    this.log.notice('onShutdown called with reason:', reason ?? 'none');

    await super.onShutdown(reason);
    if (this.rvcInterval) {
      clearInterval(this.rvcInterval);
      this.rvcInterval = undefined;
    }
    if (this.roborockService) {
      this.roborockService.stopService();
      this.roborockService = undefined;
    }
    if (this.config.unregisterOnShutdown === true) await this.unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS);
    this.isStartPluginCompleted = false;
  }

  public override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
    this.log.notice(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
    this.log.logLevel = logLevel;
    return Promise.resolve();
  }

  /**
   * Start the device discovery and authentication process.
   * Initializes the RoborockService and authenticates the user.
   * @return True if initialization is successful, false otherwise.
   */
  private async startDeviceDiscovery(): Promise<boolean> {
    this.enableExperimentalFeature = this.config.enableExperimental;
    // Disable multiple map for more investigation
    this.enableExperimentalFeature.advancedFeature.enableMultipleMap = false;

    if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature?.cleanModeSettings?.enableCleanModeMapping) {
      this.cleanModeSettings = this.enableExperimentalFeature.cleanModeSettings;
      this.log.notice(
        `Experimental Feature enabled,
         Clean Mode Settings: ${debugStringify(this.cleanModeSettings)}`,
      );
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

    const { shouldContinue, userData } = await this.authenticate(deviceId);
    if (!shouldContinue || !userData || !this.roborockService) {
      this.log.info('Authentication incomplete, waiting for user action.');
      return false;
    }

    const username = this.config.username as string;
    this.log.debug('Initializing - userData:', debugStringify(userData));
    const devices = await this.roborockService.listDevices(username);
    this.log.notice('Initializing - devices: ', debugStringify(devices));

    let vacuums: Device[] = [];
    if (this.config.whiteList.length > 0) {
      const whiteList = this.config.whiteList ?? [];
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
      return false;
    }

    if (!this.enableExperimentalFeature?.enableExperimentalFeature || !this.enableExperimentalFeature?.advancedFeature?.enableServerMode) {
      vacuums = [vacuums[0]]; // If server mode is not enabled, only use the first vacuum
    }

    for (const vacuum of vacuums) {
      await this.roborockService.initializeMessageClient(username, vacuum, userData);
      this.devices.set(vacuum.serialNumber, vacuum);
    }
    return true;
  }

  private async authenticate(deviceId: string): Promise<{ shouldContinue: boolean; userData?: UserData }> {
    const axiosInstance = axios.default ?? axios;
    const configRegion = this.config.region as string | undefined;
    const region = configRegion?.toUpperCase() ?? 'US';
    const baseUrl = getBaseUrl(configRegion);
    this.log.debug(`Using region: ${region} (${baseUrl})`);

    this.roborockService = new RoborockService(
      (_, url) => new RoborockAuthenticateApi(this.log, axiosInstance, deviceId, url),
      (logger, ud) => new RoborockIoTApi(ud, logger),
      this.config.refreshInterval ?? 60,
      this.clientManager,
      this.log,
      baseUrl,
    );

    const username = this.config.username as string;

    this.log.debug(`config: ${debugStringify(this.config)}`);

    const authenticationPayload = this.config.authentication;
    const password = authenticationPayload.password ?? '';
    const verificationCode = authenticationPayload.verificationCode ?? '';
    const authenticationMethod = authenticationPayload.authenticationMethod as 'VerificationCode' | 'Password';

    this.log.debug(
      `Authentication method: ${authenticationMethod},
      Username: ${username},
      Password provided: ${password !== ''},
      Verification code provided: ${verificationCode !== ''}`,
    );

    // Authenticate using 2FA flow
    let userData: UserData | undefined;
    try {
      if (authenticationMethod === 'VerificationCode') {
        this.log.debug('Using verification code from config for authentication');
        userData = await this.authenticate2FA(username, verificationCode);
      } else {
        userData = await this.authenticateWithPassword(username, password);
      }
    } catch (error) {
      this.log.error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
      return { shouldContinue: false };
    }

    if (!userData) {
      // Code was requested, waiting for user to enter it in config
      return { shouldContinue: false };
    }
    return { shouldContinue: true, userData };
  }

  /**
   * Configure all discovered devices.
   * Sets up device connections, room mappings, and notification handlers.
   */
  private async onConfigureDevice(): Promise<void> {
    this.log.info('onConfigureDevice start');
    if (this.platformRunner === undefined || this.roborockService === undefined) {
      this.log.error('Initializing: PlatformRunner or RoborockService is undefined');
      return;
    }

    const username = this.config.username as string;
    if (this.devices.size === 0 || !username) {
      this.log.error('Initializing: No supported devices found');
      return;
    }

    const configureSuccess = new Map<string, boolean>();

    for (const vacuum of this.devices.values()) {
      const success = await this.configureDevice(vacuum);
      configureSuccess.set(vacuum.duid, success);
      if (success) {
        this.rrHomeId = vacuum.rrHomeId;
      }
    }

    this.roborockService.setDeviceNotify(async (messageSource: NotifyMessageTypes, homeData: unknown) => {
      await this.platformRunner?.updateRobot(messageSource, homeData);
    });

    for (const [duid, robot] of this.robots.entries()) {
      if (!configureSuccess.get(duid)) {
        continue;
      }
      this.roborockService.activateDeviceNotify(robot.device);
    }

    try {
      await this.platformRunner?.requestHomeData();
    } catch (error) {
      this.log.error(`requestHomeData (initial) failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.log.info('onConfigureDevice finished');
  }

  /**
   * Configure a single device for use with the platform.
   * Establishes local connection, fetches room maps, and creates Matter endpoint.
   */
  private async configureDevice(vacuum: Device): Promise<boolean> {
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

    const behaviorHandler = configureBehavior(
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
    robot.configureHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));
    if (this.validateDevice(robot.deviceName ?? '')) {
      await this.addDevice(robot);
    }

    return true;
  }

  private async authenticateWithPassword(username: string, password: string): Promise<UserData> {
    if (!this.roborockService) {
      throw new Error('RoborockService is not initialized');
    }

    this.log.notice('Attempting login with password...');

    const userData = await this.roborockService.loginWithPassword(
      username,
      password,
      async () => {
        if (this.enableExperimentalFeature?.enableExperimentalFeature && this.enableExperimentalFeature.advancedFeature?.alwaysExecuteAuthentication) {
          this.log.debug('Always execute authentication on startup');
          return undefined;
        }

        const savedUserData = (await this.persist.getItem('userData')) as UserData | undefined;
        if (savedUserData) {
          this.log.debug('Loading saved userData:', debugStringify(savedUserData));
          return savedUserData;
        }
        return undefined;
      },
      async (userData: UserData) => {
        await this.persist.setItem('userData', userData);
      },
    );
    this.log.notice('Authentication successful!');
    return userData;
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

      if (authState?.codeRequestedAt && now - authState.codeRequestedAt < VERIFICATION_CODE_RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((VERIFICATION_CODE_RATE_LIMIT_MS - (now - authState.codeRequestedAt)) / 1000);
        this.log.warn(`Please wait ${waitSeconds} seconds before requesting another code.`);
        this.logVerificationCodeBanner(username, true);
        return undefined;
      }

      try {
        this.log.notice(`Requesting verification code for: ${username}`);
        await this.roborockService.requestVerificationCode(username);

        await this.persist.setItem('authenticateFlowState', {
          email: username,
          codeRequestedAt: now,
        } as AuthenticateFlowState);

        this.logVerificationCodeBanner(username, false);
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

  /**
   * Log verification code instructions banner.
   * @param email - User's email address
   * @param wasPreviouslySent - Whether the code was sent previously
   */
  private logVerificationCodeBanner(email: string, wasPreviouslySent: boolean): void {
    this.log.notice('============================================');
    this.log.notice('ACTION REQUIRED: Enter verification code');
    this.log.notice(`A verification code ${wasPreviouslySent ? 'was previously sent' : 'has been sent'} to: ${email}`);
    this.log.notice('Enter the 6-digit code in the plugin configuration');
    this.log.notice('under the "verificationCode" field, then restart the plugin.');
    this.log.notice('============================================');
  }

  /**
   * Add a device to the Matter bridge.
   * Configures version information and registers the device with Matterbridge.
   * @param device - The device endpoint to add
   * @returns The added device endpoint, or undefined if validation fails
   */
  private async addDevice(device: MatterbridgeEndpoint): Promise<MatterbridgeEndpoint | undefined> {
    if (!device.serialNumber || !device.deviceName) {
      this.log.warn('Cannot add device: missing serialNumber or deviceName');
      return undefined;
    }
    this.setSelectDevice(device.serialNumber, device.deviceName, undefined, 'hub');

    const vacuumFirmwareData = (device as RoborockVacuumCleaner).device.data;
    const hardwareVersionString = vacuumFirmwareData.firmwareVersion ?? (device as RoborockVacuumCleaner).device.fv ?? this.matterbridge.matterbridgeVersion;

    if (this.validateDevice(device.deviceName)) {
      device.softwareVersion = parseInt(this.version.replace(/\D/g, ''));
      device.softwareVersionString = this.version === '' ? 'Unknown' : this.version;
      device.hardwareVersion = parseInt(hardwareVersionString.replace(/\D/g, ''));
      device.hardwareVersionString = hardwareVersionString;
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
      this.robots.set(device.serialNumber, device as RoborockVacuumCleaner);
      return device;
    } else {
      return undefined;
    }
  }
}
