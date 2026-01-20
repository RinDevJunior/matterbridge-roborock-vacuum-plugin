import { AnsiLogger } from 'matterbridge/logger';
import { MessageProcessor, RoborockAuthenticateApi, RoborockIoTApi, UserData } from '@/roborockCommunication/index.js';
import type { Factory } from '@/types/index.js';
import { ClientManager, PollingService, MessageRoutingService, AreaManagementService, DeviceManagementService, AuthenticationService } from './index.js';

/** Configuration for ServiceContainer. */
export interface ServiceContainerConfig {
  /** Base URL for Roborock API */
  baseUrl: string;
  /** Refresh interval (ms) for polling */
  refreshInterval: number;
  /** Factory for auth API instances */
  authenticateApiFactory?: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
  /** Factory for IoT API instances */
  iotApiFactory?: Factory<UserData, RoborockIoTApi>;
}

/** DI container managing service lifecycle. Services are lazily created and cached. */
export class ServiceContainer {
  // Cached service instances (singletons)
  private authenticationService: AuthenticationService | undefined;
  private deviceManagementService: DeviceManagementService | undefined;
  private areaManagementService: AreaManagementService | undefined;
  private messageRoutingService: MessageRoutingService | undefined;
  private pollingService: PollingService | undefined;
  // Shared infrastructure
  private readonly loginApi: RoborockAuthenticateApi;
  private readonly authenticateApiFactory: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
  private readonly iotApiFactory: Factory<UserData, RoborockIoTApi>;
  private readonly messageProcessorMap = new Map<string, MessageProcessor>();

  // User data (set after authentication)
  private userdata?: UserData;
  private iotApi?: RoborockIoTApi;

  constructor(
    private readonly logger: AnsiLogger,
    private readonly clientManager: ClientManager,
    private readonly config: ServiceContainerConfig,
  ) {
    // Set up factory functions with defaults
    this.authenticateApiFactory = config.authenticateApiFactory ?? ((logger, baseUrl) => new RoborockAuthenticateApi(logger, undefined, undefined, baseUrl));

    this.iotApiFactory = config.iotApiFactory ?? ((logger, ud) => new RoborockIoTApi(ud, logger));

    // Create login API instance
    this.loginApi = this.authenticateApiFactory(logger, config.baseUrl);
  }

  /** Set user data after login to enable device services. */
  setUserData(userdata: UserData): void {
    this.userdata = userdata;
    this.iotApi = this.iotApiFactory(this.logger, userdata);

    // Update existing services if they're already created
    if (this.deviceManagementService) {
      this.deviceManagementService.setAuthentication(userdata);
    }
    if (this.areaManagementService && this.iotApi) {
      this.areaManagementService.setIotApi(this.iotApi);
    }
    if (this.messageRoutingService && this.iotApi) {
      this.messageRoutingService.setIotApi(this.iotApi);
    }
  }

  /** Get or create AuthenticationService singleton. */
  getAuthenticationService(): AuthenticationService {
    if (!this.authenticationService) {
      this.authenticationService = new AuthenticationService(this.loginApi, this.logger);
    }
    return this.authenticationService;
  }

  /** Get or create PollingService singleton. */
  getPollingService(): PollingService {
    if (!this.pollingService) {
      this.pollingService = new PollingService(this.config.refreshInterval, this.logger, this.getMessageRoutingService());
    }
    return this.pollingService;
  }

  /** Get or create DeviceManagementService singleton. Requires setUserData() after login. */
  getDeviceManagementService(): DeviceManagementService {
    if (!this.deviceManagementService) {
      this.deviceManagementService = new DeviceManagementService(
        this.iotApiFactory,
        this.clientManager,
        this.logger,
        this.loginApi,
        this.getMessageRoutingService(),
        this.iotApi,
        this.userdata,
      );
    }
    return this.deviceManagementService;
  }

  /**
   * Get or create the AreaManagementService singleton.
   *
   * Note: Requires user authentication. Call setUserData() after login.
   *
   * @returns AreaManagementService instance
   */
  getAreaManagementService(): AreaManagementService {
    if (!this.areaManagementService) {
      this.areaManagementService = new AreaManagementService(this.logger, this.iotApi);
    }
    return this.areaManagementService;
  }

  /**
   * Get or create the MessageRoutingService singleton.
   *
   * Note: Requires user authentication. Call setUserData() after login.
   *
   * @returns MessageRoutingService instance
   */
  getMessageRoutingService(): MessageRoutingService {
    if (!this.messageRoutingService) {
      this.messageRoutingService = new MessageRoutingService(this.logger, this.iotApi);
    }
    return this.messageRoutingService;
  }

  /**
   * Get all services as a bundle.
   * Useful for passing to RoborockService facade.
   *
   * @returns Object containing all service instances
   */
  getAllServices() {
    return {
      authentication: this.getAuthenticationService(),
      deviceManagement: this.getDeviceManagementService(),
      areaManagement: this.getAreaManagementService(),
      messageRouting: this.getMessageRoutingService(),
      polling: this.getPollingService(),
    };
  }

  /** Destroy all services and clear cached instances. */
  async destroy(): Promise<void> {
    // Shutdown polling service first
    if (this.pollingService) {
      await this.pollingService.shutdown();
    }

    // Clear service references (allows garbage collection)
    this.authenticationService = undefined;
    this.deviceManagementService = undefined;
    this.areaManagementService = undefined;
    this.messageRoutingService = undefined;
    this.pollingService = undefined;

    // Clear user data
    this.userdata = undefined;
    this.iotApi = undefined;

    // Clear message processor map
    this.messageProcessorMap.clear();

    this.logger.debug('ServiceContainer destroyed');
  }

  /** Get logger instance. */
  getLogger(): AnsiLogger {
    return this.logger;
  }

  /** Get ClientManager instance. */
  getClientManager(): ClientManager {
    return this.clientManager;
  }

  /** Get current user data (undefined if not authenticated). */
  getUserData(): UserData | undefined {
    return this.userdata;
  }

  /** Get IoT API (undefined if not authenticated). */
  getIotApi(): RoborockIoTApi | undefined {
    return this.iotApi;
  }

  /** Get shared message processor map. */
  getMessageProcessorMap(): Map<string, MessageProcessor> {
    return this.messageProcessorMap;
  }
}
