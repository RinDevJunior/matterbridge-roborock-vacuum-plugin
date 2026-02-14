import type { AnsiLogger } from 'matterbridge/logger';
import { debugStringify } from 'matterbridge/logger';
import * as axios from 'axios';
import crypto from 'node:crypto';
import NodePersist from 'node-persist';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import { PlatformConfigManager } from './platformConfigManager.js';
import { DeviceRegistry } from './deviceRegistry.js';
import { DEFAULT_REFRESH_INTERVAL_SECONDS } from '../constants/index.js';
import { RoborockService } from '../services/roborockService.js';
import { isSupportedDevice } from '../share/helper.js';
import { getBaseUrl } from '../initialData/regionUrls.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import type { Device } from '../roborockCommunication/models/index.js';

/**
 * Handles device discovery: authentication, API calls, and device filtering.
 */
export class DeviceDiscovery {
  public roborockService: RoborockService | undefined;

  public constructor(
    private readonly platform: MatterbridgeDynamicPlatform,
    private readonly configManager: PlatformConfigManager,
    private readonly registry: DeviceRegistry,
    private readonly getPersistanceStorage: () => NodePersist.LocalStorage,
    private readonly log: AnsiLogger,
  ) {}

  public async discoverDevices(): Promise<boolean> {
    this.log.info('startDeviceDiscovery start');

    const cleanModeSettings = this.configManager.cleanModeSettings;
    if (cleanModeSettings) {
      this.log.notice(
        `Custom Clean Mode Mapping Enabled: ${this.configManager.isAdvancedFeatureEnabled && this.configManager.isCustomCleanModeMappingEnabled ? 'Enabled' : 'Disabled'},
         Clean Mode Settings: ${debugStringify(cleanModeSettings)}`,
      );
    }

    const persist = this.getPersistanceStorage();

    // Load or generate sessionId for consistent authentication
    let sessionId = (await persist.getItem('sessionId')) as string | undefined;
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      await persist.setItem('sessionId', sessionId);
      this.log.debug('Generated new sessionId:', sessionId);
    } else {
      this.log.debug('Using cached sessionId:', sessionId);
    }
    const axiosInstance = axios.default ?? axios;
    const region = this.configManager.region;
    const baseUrl = getBaseUrl(region);
    this.log.debug(`Using region: ${region} (${baseUrl})`);

    this.roborockService = new RoborockService(
      {
        authenticateApiFactory: (_, url) => new RoborockAuthenticateApi(this.log, axiosInstance, sessionId, url),
        iotApiFactory: (_, ud) => new RoborockIoTApi(ud, this.log, axiosInstance),
        refreshInterval: this.configManager.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS,
        baseUrl,
        persist,
        configManager: this.configManager,
      },
      this.log,
      this.configManager,
    );

    const { userData, shouldContinue, isSuccess } = await this.roborockService.authenticate();
    if (!shouldContinue || !userData || !this.roborockService) {
      this.log.info('Authentication incomplete, waiting for user action.');
      return false;
    }

    if (isSuccess && this.configManager.alwaysExecuteAuthentication) {
      const config = this.configManager.rawConfig;
      config.authentication.forceAuthentication = false;
      await this.platform.onConfigChanged(config);
    }

    this.log.debug('Initializing - userData:', debugStringify(userData));
    const devices = await this.roborockService.listDevices();
    this.log.notice('Initializing - devices: ', debugStringify(devices));

    let vacuums: Device[] = [];

    for (const device of devices) {
      if (this.configManager.isDeviceAllowed({ duid: device.duid, deviceName: device.name }) && isSupportedDevice(device.specs.model)) {
        vacuums.push(device);
      }
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
}
