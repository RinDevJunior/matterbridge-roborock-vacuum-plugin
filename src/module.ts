import { PlatformMatterbridge, MatterbridgeDynamicPlatform, PlatformConfig } from 'matterbridge';
import NodePersist from 'node-persist';
import Path from 'node:path';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { RoborockService } from './services/roborockService.js';
import { PLUGIN_NAME } from './settings.js';
import { PlatformRunner } from './platformRunner.js';
import { FilterLogger } from './share/filterLogger.js';

// Platform layer imports
import { DeviceRegistry } from './platform/deviceRegistry.js';
import { PlatformConfigManager } from './platform/platformConfigManager.js';
import { PlatformLifecycle, LifecycleDependencies } from './platform/platformLifecycle.js';
import { PlatformState } from './platform/platformState.js';
import { RoborockPluginPlatformConfig } from './model/RoborockPluginPlatformConfig.js';

export default function initializePlugin(matterbridge: PlatformMatterbridge, log: AnsiLogger, config: PlatformConfig): RoborockMatterbridgePlatform {
  return new RoborockMatterbridgePlatform(matterbridge, log, config as RoborockPluginPlatformConfig);
}

/**
 * Refactored platform using new platform layer classes.
 * Lifecycle, config, registry, and state are delegated to dedicated modules.
 */
export class RoborockMatterbridgePlatform extends MatterbridgeDynamicPlatform {
  public platformRunner: PlatformRunner;
  public persist: NodePersist.LocalStorage;
  public readonly registry: DeviceRegistry;
  public readonly configManager: PlatformConfigManager;
  public readonly lifecycle: PlatformLifecycle;
  public readonly state: PlatformState;

  public get roborockService(): RoborockService | undefined {
    return this.lifecycle.roborockService;
  }

  public set roborockService(value: RoborockService | undefined) {
    this.lifecycle.roborockService = value;
  }

  public get rrHomeId(): number | undefined {
    return this.lifecycle.rrHomeId;
  }

  public set rrHomeId(value: number | undefined) {
    this.lifecycle.rrHomeId = value;
  }

  constructor(
    matterbridge: PlatformMatterbridge,
    logger: AnsiLogger,
    override config: RoborockPluginPlatformConfig,
  ) {
    super(matterbridge, new FilterLogger(logger, config.pluginConfiguration.sanitizeSensitiveLogs), config);
    logger.logLevel = this.config.pluginConfiguration.debug ? LogLevel.DEBUG : LogLevel.INFO;

    const requiredMatterbridgeVersion = '3.5.3';
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
      clearSelect: () => this.clearSelect(),
      unregisterAllDevices: (delay) => this.unregisterAllDevices(delay),
    };
    this.lifecycle = new PlatformLifecycle(this, this.configManager, this.state, this.registry, deps);
  }

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
}
