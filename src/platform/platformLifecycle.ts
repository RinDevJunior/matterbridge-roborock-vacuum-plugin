import type { AnsiLogger } from 'matterbridge/logger';
import NodePersist from 'node-persist';
import { PlatformConfigManager } from './platformConfigManager.js';
import { PlatformState } from './platformState.js';
import { DeviceRegistry } from './deviceRegistry.js';
import { DeviceDiscovery } from './deviceDiscovery.js';
import { DeviceConfigurator } from './deviceConfigurator.js';
import { MatterbridgeDynamicPlatform } from 'matterbridge';
import { DEFAULT_REFRESH_INTERVAL_SECONDS, REFRESH_INTERVAL_BUFFER_MS, UNREGISTER_DEVICES_DELAY_MS } from '../constants/index.js';
import type { RoborockService } from '../services/roborockService.js';
import type { PlatformRunner } from '../platformRunner.js';

/** Dependencies required by PlatformLifecycle */
export interface LifecycleDependencies {
  getPersistanceStorage: () => NodePersist.LocalStorage;
  getPlatformRunner: () => PlatformRunner | undefined;
  clearSelect: () => Promise<void>;
  unregisterAllDevices: (delay?: number) => Promise<void>;
}

/**
 * Manages platform lifecycle events (onStart, onConfigure, onShutdown).
 * Coordinates initialization, polling intervals, and cleanup.
 * Delegates device discovery and configuration to dedicated classes.
 */
export class PlatformLifecycle {
  private readonly log: AnsiLogger;
  private rvcInterval: NodeJS.Timeout | undefined;
  public readonly discovery: DeviceDiscovery;
  public readonly configurator: DeviceConfigurator;

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

  public constructor(
    private readonly platform: MatterbridgeDynamicPlatform,
    private readonly configManager: PlatformConfigManager,
    private readonly state: PlatformState,
    registry: DeviceRegistry,
    private readonly deps: LifecycleDependencies,
  ) {
    this.log = platform.log;
    this.discovery = new DeviceDiscovery(platform, configManager, registry, deps.getPersistanceStorage, this.log);
    this.configurator = new DeviceConfigurator(platform, configManager, registry, deps.getPlatformRunner, this.log);
  }

  /**
   * Called when the platform starts.
   * Initializes storage, validates config, starts device discovery.
   */
  public async onStart(reason?: string): Promise<void> {
    this.log.notice('onStart called with reason:', reason ?? 'none');

    // Wait for the platform to be ready
    await this.platform.ready;
    await this.deps.clearSelect();
    await this.deps.getPersistanceStorage().init();

    if (this.configManager.isClearStorageOnStartupEnabled) {
      return;
    }

    // Clear storage if alwaysExecuteAuthentication is set
    if (this.configManager.alwaysExecuteAuthentication) {
      await this.deps.getPersistanceStorage().clear();
    }

    // Validate configuration
    if (!this.configManager.validateConfig()) {
      this.log.error('"username" (email address) is required in the config');
      this.state.setStartupCompleted(false);
      return;
    }

    // Start device discovery and authentication
    const shouldContinue = await this.discovery.discoverDevices();
    if (!shouldContinue) {
      this.log.error('Device discovery failed to start.');
      this.state.setStartupCompleted(false);
      return;
    }

    // Configure discovered devices
    if (!this.discovery.roborockService) {
      this.log.error('Initializing: RoborockService is undefined');
      this.state.setStartupCompleted(false);
      return;
    }
    await this.configurator.onConfigureDevice(this.discovery.roborockService);

    // Mark startup as complete
    this.log.notice('onStart finished');
    this.state.setStartupCompleted(true);
  }

  /**
   * Called when the platform is configured.
   * Sets up periodic polling for device status updates.
   */
  public async onConfigure(): Promise<void> {
    this.log.notice('onConfigure called');

    // if clearStorageOnStartup flag enabled, clear persistence storage
    if (this.configManager.isClearStorageOnStartupEnabled) {
      this.log.warn('Clearing persistence storage as per configuration.');
      await this.deps
        .getPersistanceStorage()
        .clear()
        .then(() => this.deps.unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS))
        .then(() => {
          this.log.notice('Please restart the platform now.');
        })
        .then(() => {
          const config = this.configManager.rawConfig;
          config.authentication.verificationCode = '';
          config.advancedFeature.settings.clearStorageOnStartup = false;
          return this.platform.onConfigChanged(config);
        })
        .catch((error) => {
          this.log.error(`Error clearing persistence storage: ${error}`);
        });
    }

    if (!this.state.isStartupCompleted) {
      return;
    }

    // Set up periodic status refresh
    const intervalMs = (this.configManager.refreshInterval ?? DEFAULT_REFRESH_INTERVAL_SECONDS) * 1000 + REFRESH_INTERVAL_BUFFER_MS;

    this.rvcInterval = setInterval(async () => {
      try {
        const runner = this.deps.getPlatformRunner();
        await runner?.requestHomeData();
      } catch (error) {
        this.log.error(`requestHomeData (interval) failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, intervalMs);
  }

  /**
   * Called when the platform shuts down.
   * Cleans up intervals, services, and optionally unregisters devices.
   */
  public async onShutdown(reason?: string): Promise<void> {
    this.log.notice('onShutdown called with reason:', reason ?? 'none');

    // Clear polling interval
    if (this.rvcInterval) {
      clearInterval(this.rvcInterval);
      this.rvcInterval = undefined;
    }

    // Stop Roborock service
    if (this.roborockService) {
      this.roborockService.stopService();
      this.roborockService = undefined;
    }

    // Unregister devices if configured
    if (this.configManager.unregisterOnShutdown) {
      await this.deps.unregisterAllDevices(UNREGISTER_DEVICES_DELAY_MS);
    }

    // Reset state
    this.state.setStartupCompleted(false);
  }
}
