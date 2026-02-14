import { PlatformMatterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import NodePersist from 'node-persist';
import Path from 'node:path';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { RoborockService } from './services/roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import { PlatformRunner } from './platformRunner.js';
import { FilterLogger } from './share/filterLogger.js';
import { DEFAULT_REFRESH_INTERVAL_SECONDS, REFRESH_INTERVAL_BUFFER_MS, UNREGISTER_DEVICES_DELAY_MS } from './constants/index.js';

// Platform layer imports
import { DeviceRegistry } from './platform/deviceRegistry.js';
import { PlatformConfigManager } from './platform/platformConfigManager.js';
import { DeviceDiscovery } from './platform/deviceDiscovery.js';
import { DeviceConfigurator } from './platform/deviceConfigurator.js';
import { PlatformState } from './platform/platformState.js';
import { RoborockPluginPlatformConfig } from './model/RoborockPluginPlatformConfig.js';

export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): RoborockMatterbridgePlatform {
  return new RoborockMatterbridgePlatform(matterbridge, log, config as RoborockPluginPlatformConfig);
}

/**
 * Roborock vacuum platform for Matterbridge.
 * Orchestrates device discovery, configuration, and lifecycle management.
 */
export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  public platformRunner: PlatformRunner;
  public persist: NodePersist.LocalStorage;

  // Platform layer
  public readonly registry: DeviceRegistry;
  public readonly configManager: PlatformConfigManager;
  public readonly discovery: DeviceDiscovery;
  public readonly configurator: DeviceConfigurator;
  public readonly state: PlatformState;

  private rvcInterval: NodeJS.Timeout | undefined;

  public get roborockService(): RoborockService | undefined {
    return this.discovery.roborockService;
  }

  public set roborockService(value: RoborockService | undefined) {
    this.discovery.roborockService = value;
  }

  public get rrHomeId(): number | undefined {
    return this.configurator.rrHomeId;
  }

  public set rrHomeId(value: number | undefined) {
    this.configurator.rrHomeId = value;
  }

  constructor(
    matterbridge: PlatformMatterbridge,
    logger: AnsiLogger,
    override config: RoborockPluginPlatformConfig,
  ) {
    super(matterbridge, new FilterLogger(logger, config.pluginConfiguration.sanitizeSensitiveLogs), config);
    logger.logLevel = this.config.pluginConfiguration.debug ? LogLevel.DEBUG : LogLevel.INFO;

    const requiredMatterbridgeVersion = '3.5.4';
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

    // Create discovery and configurator
    this.discovery = new DeviceDiscovery(this, this.configManager, this.registry, () => this.persist, this.log);
    this.configurator = new DeviceConfigurator(this, this.configManager, this.registry, () => this.platformRunner, this.log);
  }

  // #region Lifecycle
  public override async onStart(reason?: string): Promise<void> {
    this.log.notice('onStart called with reason:', reason ?? 'none');

    await this.ready;
    await this.clearSelect();
    await this.persist.init();

    if (this.configManager.isClearStorageOnStartupEnabled) {
      return;
    }

    if (this.configManager.alwaysExecuteAuthentication) {
      await this.persist.clear();
    }

    if (!this.configManager.validateConfig()) {
      this.log.error('"username" (email address) is required in the config');
      this.state.setStartupCompleted(false);
      return;
    }

    const shouldContinue = await this.discovery.discoverDevices();
    if (!shouldContinue) {
      this.log.error('Device discovery failed to start.');
      this.state.setStartupCompleted(false);
      return;
    }

    if (!this.discovery.roborockService) {
      this.log.error('Initializing: RoborockService is undefined');
      this.state.setStartupCompleted(false);
      return;
    }
    await this.configurator.onConfigureDevice(this.discovery.roborockService);

    this.log.notice('onStart finished');
    this.state.setStartupCompleted(true);
  }

  public override async onConfigure(): Promise<void> {
    await super.onConfigure();
    this.log.notice('onConfigure called');

    if (this.configManager.isClearStorageOnStartupEnabled) {
      this.log.warn('Clearing persistence storage as per configuration.');
      await this.persist
        .clear()
        .then(() => this.unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS))
        .then(() => {
          this.log.notice('Please restart the platform now.');
        })
        .then(() => {
          const config = this.configManager.rawConfig;
          config.authentication.verificationCode = '';
          config.advancedFeature.settings.clearStorageOnStartup = false;
          return this.onConfigChanged(config);
        })
        .catch((error) => {
          this.log.error(`Error clearing persistence storage: ${error}`);
        });
    }

    if (!this.state.isStartupCompleted) {
      return;
    }

    const intervalMs = (this.configManager.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS) * 1000 + REFRESH_INTERVAL_BUFFER_MS;

    this.rvcInterval = setInterval(async () => {
      try {
        await this.platformRunner?.requestHomeData();
      } catch (error) {
        this.log.error(`requestHomeData (interval) failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, intervalMs);
  }

  public override async onShutdown(reason?: string): Promise<void> {
    await super.onShutdown(reason);
    this.log.notice('onShutdown called with reason:', reason ?? 'none');

    if (this.rvcInterval) {
      clearInterval(this.rvcInterval);
      this.rvcInterval = undefined;
    }

    if (this.roborockService) {
      this.roborockService.stopService();
      this.roborockService = undefined;
    }

    if (this.configManager.unregisterOnShutdown) {
      await this.unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS);
    }

    this.state.setStartupCompleted(false);
  }

  public override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
    this.log.notice(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
    this.log.logLevel = logLevel;
  }
  // #endregion Lifecycle
}
