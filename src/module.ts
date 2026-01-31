import { PlatformMatterbridge, MatterbridgeDynamicPlatform, PlatformConfig, MatterbridgeEndpoint, bridgedNode } from 'matterbridge';
import { BridgedDeviceBasicInformation, Descriptor, ServiceArea } from 'matterbridge/matter/clusters';
import * as axios from 'axios';
import crypto from 'node:crypto';
import NodePersist from 'node-persist';
import Path from 'node:path';
import { AnsiLogger, debugStringify, LogLevel } from 'matterbridge/logger';
import { isValidNumber, isValidString } from 'matterbridge/utils';
import { RoborockService } from './services/roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import { isSupportedDevice } from './share/helper.js';
import { RoomMap } from './core/application/models/index.js';
import { PlatformRunner } from './platformRunner.js';
import { FilterLogger } from './share/filterLogger.js';
import { RoborockVacuumCleaner } from './types/roborockVacuumCleaner.js';
import { configureBehavior } from './share/behaviorFactory.js';
import { NotifyMessageTypes, MessagePayload } from './types/index.js';
import { getSupportedAreas, getSupportedScenes } from './initialData/index.js';

import { getBaseUrl } from './initialData/regionUrls.js';
import { Identify } from '@matter/types';
import { UINT16_MAX, UINT32_MAX } from 'matterbridge/matter';
import { Device, RoomDto } from './roborockCommunication/models/index.js';
import { RoborockAuthenticateApi } from './roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from './roborockCommunication/api/iotClient.js';

// Platform layer imports
import { DeviceRegistry } from './platform/deviceRegistry.js';
import { PlatformConfigManager, RoborockPluginPlatformConfig } from './platform/platformConfig.js';
import { PlatformLifecycle, LifecycleDependencies } from './platform/platformLifecycle.js';
import { PlatformState } from './platform/platformState.js';
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from './constants/index.js';

export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): RoborockMatterbridgePlatform {
  return new RoborockMatterbridgePlatform(matterbridge, log, config as RoborockPluginPlatformConfig);
}

/**
 * Refactored platform using new platform layer classes.
 * Lifecycle, config, registry, and state are delegated to dedicated modules.
 */
export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  public roborockService: RoborockService | undefined;
  public platformRunner: PlatformRunner;
  public persist: NodePersist.LocalStorage;
  public rvcInterval: NodeJS.Timeout | undefined;
  public rrHomeId: number | undefined;

  // Platform layer
  public readonly registry: DeviceRegistry;
  public readonly configManager: PlatformConfigManager;
  public readonly lifecycle: PlatformLifecycle;
  public readonly state: PlatformState;

  constructor(
    matterbridge: PlatformMatterbridge,
    logger: AnsiLogger,
    override config: RoborockPluginPlatformConfig,
  ) {
    super(matterbridge, new FilterLogger(logger, config.sanitizeSensitiveLogs), config);

    const requiredMatterbridgeVersion = '3.5.0';
    if (this.verifyMatterbridgeVersion === undefined || typeof this.verifyMatterbridgeVersion !== 'function' || !this.verifyMatterbridgeVersion(requiredMatterbridgeVersion)) {
      throw new Error(
        `This plugin requires Matterbridge version >= "${requiredMatterbridgeVersion}".
        Please update Matterbridge from ${this.matterbridge.matterbridgeVersion} to the latest version in the frontend.`,
      );
    }
    this.log.info('Initializing platform:', this.config.name);

    // Initialize persistence
    const persistDir = Path.join(this.matterbridge.matterbridgePluginDirectory, PLUGIN_NAME, 'persist');
    this.persist = NodePersist.create({ dir: persistDir });

    // Initialize platform layer
    this.configManager = PlatformConfigManager.create(config, this.log);
    this.registry = new DeviceRegistry();
    this.state = new PlatformState();
    this.platformRunner = new PlatformRunner(this);

    // Create lifecycle dependencies
    const deps: LifecycleDependencies = {
      getPersistanceStorage: () => this.persist,
      getPlatformRunner: () => this.platformRunner,
      getRoborockService: () => this.roborockService,
      startDeviceDiscovery: () => this.startDeviceDiscovery(),
      onConfigureDevice: () => this.onConfigureDevice(),
      clearSelect: () => this.clearSelect(),
      unregisterAllDevices: (delay) => this.unregisterAllDevices(delay),
    };
    this.lifecycle = new PlatformLifecycle(this, this.configManager, this.state, deps);
  }

  // ─── Lifecycle Delegation ───────────────────────────────────────────────────

  public override async onStart(reason?: string): Promise<void> {
    await this.lifecycle.onStart(reason);
  }

  public override async onConfigure(): Promise<void> {
    await super.onConfigure();
    await this.lifecycle.onConfigure();
  }

  public override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    await this.lifecycle.onShutdown(reason);
  }

  public override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
    this.log.notice(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
    this.log.logLevel = logLevel;
  }

  // ─── Device Discovery & Configuration ───────────────────────────────────────

  private async startDeviceDiscovery(): Promise<boolean> {
    this.log.info('startDeviceDiscovery start');

    const cleanModeSettings = this.configManager.cleanModeSettings;
    if (cleanModeSettings) {
      this.log.notice(
        `Experimental Feature: ${this.configManager.isExperimentalEnabled ? 'Enabled' : 'Disabled'},
         Clean Mode Settings: ${debugStringify(cleanModeSettings)}`,
      );
    }

    // Load or generate sessionId for consistent authentication
    let sessionId = (await this.persist.getItem('sessionId')) as string | undefined;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await this.persist.setItem('sessionId', sessionId);
      this.log.debug('Generated new sessionId:', sessionId);
    } else {
      this.log.debug('Using cached sessionId:', sessionId);
    }
    const axiosInstance = axios.default ?? axios;
    const configRegion = this.config.region as string | undefined;
    const region = configRegion?.toUpperCase() ?? 'US';
    const baseUrl = getBaseUrl(configRegion);
    this.log.debug(`Using region: ${region} (${baseUrl})`);

    this.roborockService = new RoborockService(
      {
        authenticateApiFactory: (_, url) => new RoborockAuthenticateApi(this.log, axiosInstance, sessionId, url),
        iotApiFactory: (logger, ud) => new RoborockIoTApi(ud, this.log, axiosInstance),
        refreshInterval: this.config.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS,
        baseUrl,
        persist: this.persist,
        configManager: this.configManager,
      },
      this.log,
      this.configManager,
    );

    const { userData, shouldContinue } = await this.roborockService.authenticate();
    if (!shouldContinue || !userData || !this.roborockService) {
      this.log.info('Authentication incomplete, waiting for user action.');
      return false;
    }

    this.log.debug('Initializing - userData:', debugStringify(userData));
    const devices = await this.roborockService.listDevices();
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

    if (!this.configManager.isServerModeEnabled) {
      vacuums = [vacuums[0]]; // If server mode is not enabled, only use the first vacuum
    }

    for (const vacuum of vacuums) {
      await this.roborockService.initializeMessageClient(vacuum, userData);
      this.registry.registerDevice(vacuum);
    }
    return true;
  }

  private async onConfigureDevice(): Promise<void> {
    this.log.info('onConfigureDevice start');
    if (this.roborockService === undefined) {
      this.log.error('Initializing: RoborockService is undefined');
      return;
    }

    const username = this.config.username as string;
    if (!this.registry.hasDevices() || !username) {
      this.log.error('Initializing: No supported devices found');
      return;
    }

    const configureSuccess = new Map<string, boolean>();

    for (const vacuum of this.registry.getAllDevices()) {
      const success = await this.configureDevice(vacuum);
      configureSuccess.set(vacuum.duid, success);
      if (success) {
        this.rrHomeId = vacuum.rrHomeId;
      }
    }

    this.roborockService.setDeviceNotify(async (messageSource: NotifyMessageTypes, homeData: unknown) => {
      const duid = (homeData as { duid?: string })?.duid ?? '';
      const payload = { type: messageSource, data: homeData, duid };
      await this.platformRunner.updateRobotWithPayload(payload as unknown as MessagePayload);
    });

    for (const [duid, robot] of this.registry.robotsMap) {
      if (!configureSuccess.get(duid)) {
        continue;
      }
      this.roborockService.activateDeviceNotify(robot.device);
    }

    try {
      await this.platformRunner.requestHomeData();
    } catch (error) {
      this.log.error(`requestHomeData (initial) failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    this.log.info('onConfigureDevice finished');
  }

  private async configureDevice(vacuum: Device): Promise<boolean> {
    const username = this.config.username as string;

    if (this.roborockService === undefined) {
      this.log.error('Initializing: RoborockService is undefined');
      return false;
    }

    const connectedToLocalNetwork = await this.roborockService.initializeMessageClientForLocal(vacuum);

    if (!connectedToLocalNetwork) {
      this.log.error(`Failed to connect to local network for device: ${vacuum.name} (${vacuum.duid})`);
      return false;
    }

    if (vacuum.rooms === undefined || vacuum.rooms.length === 0) {
      this.log.notice(`Fetching map information for device: ${vacuum.name} (${vacuum.duid}) to get rooms`);
      const map_info = await this.roborockService.getMapInfo(vacuum.duid);
      const rooms = map_info.allRooms ?? [];
      vacuum.rooms = rooms.map((room) => ({ id: room.globalId, name: room.iot_name }) as RoomDto);
    }

    const roomMap = await RoomMap.fromDeviceDirect(vacuum, this);

    this.log.debug('Initializing - roomMap: ', debugStringify(roomMap));

    const behaviorHandler = configureBehavior(
      vacuum.data.model,
      vacuum.duid,
      this.roborockService,
      this.configManager.cleanModeSettings,
      this.configManager.forceRunAtDefault,
      this.log,
    );

    const { supportedAreas, roomIndexMap } = getSupportedAreas(vacuum.rooms, roomMap, this.configManager.isMultipleMapEnabled, this.log, []); // TODO: populate mapInfos
    this.roborockService.setSupportedAreas(vacuum.duid, supportedAreas);
    this.roborockService.setSupportedAreaIndexMap(vacuum.duid, roomIndexMap);

    let routineAsRoom: ServiceArea.Area[] = [];
    if (this.configManager.showRoutinesAsRoom) {
      routineAsRoom = getSupportedScenes(vacuum.scenes ?? [], this.log);
      this.roborockService.setSupportedScenes(vacuum.duid, routineAsRoom);
    }

    const robot = new RoborockVacuumCleaner(username, vacuum, roomMap, routineAsRoom, this.configManager, this.log, []); // TODO: populate mapInfos
    robot.configureHandler(behaviorHandler);

    this.log.info('vacuum:', debugStringify(vacuum));
    if (this.validateDevice(robot.deviceName ?? '')) {
      await this.addDevice(robot);
    }

    return true;
  }

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
        options.softwareVersion = device.softwareVersion ?? 1;
        options.softwareVersionString = device.softwareVersionString ?? '1.0.0';
        options.hardwareVersion = device.hardwareVersion ?? 1;
        options.hardwareVersionString = device.hardwareVersionString ?? '1.0.0';
      }
      // Add the Identify cluster with the IdentifyType attribute
      // By default, use IdentifyType.AudibleBeep (audible beep)
      const defaultIdentifyType = Identify.IdentifyType.AudibleBeep;
      device.createDefaultIdentifyClusterServer(0, defaultIdentifyType);
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
      this.registry.registerRobot(device as RoborockVacuumCleaner);
      return device;
    } else {
      return undefined;
    }
  }
}
