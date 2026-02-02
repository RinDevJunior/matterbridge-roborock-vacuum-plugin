import { AnsiLogger } from 'matterbridge/logger';
import { LocalStorage } from 'node-persist';
import type { Factory } from '../types/index.js';
import { AuthenticationService } from './authenticationService.js';
import { DeviceManagementService } from './deviceManagementService.js';
import { AreaManagementService } from './areaManagementService.js';
import { MessageRoutingService } from './messageRoutingService.js';
import { PollingService } from './pollingService.js';
import ClientManager from './clientManager.js';
import { ServiceContainer as CoreServiceContainer } from '../core/ServiceContainer.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { UserData } from '../roborockCommunication/models/index.js';
import { PlatformConfigManager } from '../platform/platformConfig.js';
import { ConnectionService } from './connectionService.js';

/** Configuration for ServiceContainer. */
export interface ServiceContainerConfig {
  baseUrl: string;
  refreshInterval: number;
  authenticateApiFactory?: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
  iotApiFactory?: Factory<UserData, RoborockIoTApi>;
  persist: LocalStorage;
  configManager: PlatformConfigManager;
}

/** DI container managing service lifecycle. Services are lazily created and cached. */
export class ServiceContainer {
  // Cached service instances (singletons)
  private authenticationService: AuthenticationService | undefined;
  private deviceManagementService: DeviceManagementService | undefined;
  private areaManagementService: AreaManagementService | undefined;
  private messageRoutingService: MessageRoutingService | undefined;
  private pollingService: PollingService | undefined;
  private connectionService: ConnectionService | undefined;
  // Shared infrastructure
  private readonly authenticateApi: RoborockAuthenticateApi;
  private readonly authenticateApiFactory: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
  private readonly iotApiFactory: Factory<UserData, RoborockIoTApi>;
  private readonly coreServiceContainer: CoreServiceContainer;
  private readonly clientManager: ClientManager;

  // User data (set after authentication)
  private userdata?: UserData;
  private iotApi?: RoborockIoTApi;

  constructor(
    private readonly logger: AnsiLogger,
    private readonly config: ServiceContainerConfig,
  ) {
    // Set up factory functions with defaults
    this.authenticateApiFactory = config.authenticateApiFactory ?? ((logger, baseUrl) => new RoborockAuthenticateApi(logger, undefined, undefined, baseUrl));
    this.iotApiFactory = config.iotApiFactory ?? ((logger, ud) => new RoborockIoTApi(ud, logger));

    this.clientManager = new ClientManager(this.logger);

    // Create login API instance
    this.authenticateApi = this.authenticateApiFactory(logger, config.baseUrl);

    // Create core service container for port adapters
    this.coreServiceContainer = new CoreServiceContainer(logger, this.authenticateApi);
  }

  /** Set user data after login to enable device services. */
  setUserData(userdata: UserData): void {
    this.userdata = userdata;
    this.iotApi = this.iotApiFactory(this.logger, userdata);

    // Initialize core service container with user data
    this.coreServiceContainer.initialize(userdata);

    // Update existing services if they're already created
    if (this.deviceManagementService) {
      this.deviceManagementService.setIotApi(this.iotApi);
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
      // Use IAuthGateway from core service container
      const authGateway = this.coreServiceContainer.getAuthGateway();
      this.authenticationService = new AuthenticationService(authGateway, this.config.persist, this.logger, this.config.configManager);
    }
    return this.authenticationService;
  }

  /** Get or create PollingService singleton. */
  getPollingService(): PollingService {
    this.pollingService ??= new PollingService(this.config.refreshInterval, this.logger, this.getMessageRoutingService());
    return this.pollingService;
  }

  /** Get or create DeviceManagementService singleton. Requires setUserData() after login. */
  getDeviceManagementService(): DeviceManagementService {
    this.deviceManagementService ??= new DeviceManagementService(this.logger, this.authenticateApi, this.userdata);
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
    this.areaManagementService ??= new AreaManagementService(this.logger, this.getMessageRoutingService());
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
    this.messageRoutingService ??= new MessageRoutingService(this.logger, this.iotApi);
    return this.messageRoutingService;
  }

  getConnectionService(): ConnectionService {
    return (this.connectionService ??= new ConnectionService(this.clientManager, this.logger, this.getMessageRoutingService()));
  }

  public synchronizeMessageClients(): void {
    const clientRouter = this.connectionService?.clientRouter;
    if (!clientRouter) {
      throw new Error('Message client not initialized in ConnectionService');
    }

    this.areaManagementService?.setMessageClient(clientRouter);
  }

  /**
   * Get all services as a bundle.
   * Useful for passing to RoborockService facade.
   */
  getAllServices() {
    return {
      authentication: this.getAuthenticationService(),
      deviceManagement: this.getDeviceManagementService(),
      areaManagement: this.getAreaManagementService(),
      messageRouting: this.getMessageRoutingService(),
      polling: this.getPollingService(),
      connection: this.getConnectionService(),
    };
  }

  /** Destroy all services and clear cached instances. */
  async destroy(): Promise<void> {
    // Shutdown polling service first
    if (this.pollingService) {
      await this.pollingService.shutdown();
    }

    if (this.connectionService) {
      await this.connectionService.shutdown();
      this.connectionService = undefined;
    }

    if (this.messageRoutingService) {
      this.messageRoutingService.clearAll();
      this.messageRoutingService = undefined;
    }

    if (this.areaManagementService) {
      this.areaManagementService.clearAll();
      this.areaManagementService = undefined;
    }

    if (this.deviceManagementService) {
      this.deviceManagementService.stopService();
      this.deviceManagementService = undefined;
    }

    if (this.authenticationService) {
      this.authenticationService = undefined;
    }

    if (this.pollingService) {
      await this.pollingService.shutdown();
      this.pollingService = undefined;
    }

    // Dispose core service container
    await this.coreServiceContainer.shutdown();

    // Clear user data
    this.userdata = undefined;
    this.iotApi = undefined;

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
}
