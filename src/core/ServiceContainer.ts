import { AnsiLogger } from 'matterbridge/logger';
import type { IDeviceGateway } from './ports/IDeviceGateway.js';
import type { IAuthGateway } from './ports/IAuthGateway.js';
import { RoborockDeviceGateway } from '../roborockCommunication/adapters/RoborockDeviceGateway.js';
import { RoborockAuthGateway } from '../roborockCommunication/adapters/RoborockAuthGateway.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { ClientRouter } from '../roborockCommunication/routing/clientRouter.js';
import { UserData } from '../roborockCommunication/models/index.js';

/**
 * Service container for dependency injection.
 * Centralizes creation and wiring of all gateway adapters.
 */
export class ServiceContainer {
  private readonly logger: AnsiLogger;
  private deviceGateway?: IDeviceGateway;
  private readonly authGateway: IAuthGateway;
  private clientRouter?: ClientRouter;

  public constructor(
    logger: AnsiLogger,
    private readonly authenticateApi: RoborockAuthenticateApi,
  ) {
    this.logger = logger;
    this.authGateway = new RoborockAuthGateway(this.authenticateApi, this.logger);
  }

  /**
   * Initialize the container with user data.
   * Call this after successful authentication to enable device services.
   */
  public initialize(userData: UserData): void {
    // Create client router for device communication
    this.clientRouter = new ClientRouter(this.logger, userData);
    this.deviceGateway = new RoborockDeviceGateway(this.clientRouter, this.logger);
    this.logger.info('Service container initialized with user data');
  }

  /**
   * Get the device gateway instance.
   */
  public getDeviceGateway(): IDeviceGateway {
    if (!this.deviceGateway) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }
    return this.deviceGateway;
  }

  /**
   * Get the authentication gateway instance.
   * Available immediately after construction.
   */
  public getAuthGateway(): IAuthGateway {
    return this.authGateway;
  }

  /**
   * Get the client router instance (for backward compatibility).
   */
  public getClientRouter(): ClientRouter {
    if (!this.clientRouter) {
      throw new Error('ServiceContainer not initialized. Call initialize() first.');
    }
    return this.clientRouter;
  }

  /**
   * Clean up resources.
   */
  public async dispose(): Promise<void> {
    if (this.clientRouter) {
      await this.clientRouter.disconnect();
    }
    this.logger.info('Service container disposed');
  }
}
