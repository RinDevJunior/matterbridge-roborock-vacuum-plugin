import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { LocalStorage } from 'node-persist';
import { DeviceNotifyCallback, Factory } from '../types/index.js';
import {
  ServiceContainer,
  ServiceContainerConfig,
  DeviceManagementService,
  AreaManagementService,
  MessageRoutingService,
  PollingService,
  ConnectionService,
} from '../services/index.js';
import { AuthenticationCoordinator } from './authentication/AuthenticationCoordinator.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { Device, Home, RawRoomMappingData, RequestMessage, Scene, UserData } from '../roborockCommunication/models/index.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { MapInfo, RoomIndexMap } from '../core/application/models/index.js';
import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';

export interface RoborockServiceConfig {
  authenticateApiFactory?: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
  iotApiFactory?: Factory<UserData, RoborockIoTApi>;
  refreshInterval: number;
  baseUrl: string;
  persist: LocalStorage;
  configManager: PlatformConfigManager;
  container?: ServiceContainer;
}

/** Facade coordinating Auth, Device, Area, and Message services via ServiceContainer. */
export class RoborockService {
  private readonly container: ServiceContainer;
  private readonly authCoordinator: AuthenticationCoordinator;
  private readonly deviceService: DeviceManagementService;
  private readonly areaService: AreaManagementService;
  private readonly messageService: MessageRoutingService;
  private readonly pollingService: PollingService;
  private readonly connectionService: ConnectionService;

  public deviceNotify: DeviceNotifyCallback | undefined;

  constructor(
    params: RoborockServiceConfig,
    private logger: AnsiLogger,
    private configManager: PlatformConfigManager,
  ) {
    if (params.container) {
      // Use injected container (for testing)
      this.container = params.container;
    } else {
      // Create service container with configuration (production)
      const config: ServiceContainerConfig = {
        baseUrl: params.baseUrl,
        refreshInterval: params.refreshInterval,
        authenticateApiFactory: params.authenticateApiFactory,
        iotApiFactory: params.iotApiFactory,
        persist: params.persist,
        configManager: params.configManager,
      };
      this.container = new ServiceContainer(logger, config);
    }

    // Get service instances
    this.authCoordinator = this.container.getAuthenticationCoordinator();
    this.deviceService = this.container.getDeviceManagementService();
    this.areaService = this.container.getAreaManagementService();
    this.messageService = this.container.getMessageRoutingService();
    this.pollingService = this.container.getPollingService();
    this.connectionService = this.container.getConnectionService();
  }

  // ============================================================================
  // Authentication Methods (delegate to AuthenticationCoordinator)
  // ============================================================================

  public async authenticate(): Promise<{ userData: UserData | undefined; shouldContinue: boolean }> {
    if (!this.configManager) {
      throw new Error('PlatformConfigManager not provided. Cannot authenticate.');
    }

    const username = this.configManager.username;
    const password = this.configManager.password;
    const verificationCode = this.configManager.verificationCode;
    const method = this.configManager.authenticationMethod;

    this.logger.debug(
      `Authenticating method: ${method},
      Username: ${username},
      Password: ${password ? '******' : '<not provided>'},
      Verification Code: ${verificationCode ? '******' : '<not provided>'}`,
    );
    let userData: UserData | undefined;
    try {
      userData = await this.authCoordinator.authenticate(method, {
        username,
        password,
        verificationCode,
      });
    } catch (error) {
      this.logger.error(`Authentication failed: ${(error as Error).message}`);
      return { userData: undefined, shouldContinue: false };
    }

    if (!userData) {
      this.logger.info('Authentication incomplete. Further action required (e.g., 2FA).');
      return { userData: undefined, shouldContinue: false };
    }

    this.logger.info(`Authentication successful for user: ${userData.nickname} (${userData.username})`);
    this.container.setUserData(userData);
    return { userData, shouldContinue: true };
  }

  // ============================================================================
  // Device Management Methods (delegate to DeviceManagementService)
  // ============================================================================

  /** List all devices for the user's account. */
  public async listDevices(): Promise<Device[]> {
    return this.deviceService.listDevices();
  }

  /** Get home data for periodic updates. */
  public async getHomeDataForUpdating(homeid: number): Promise<Home | undefined> {
    return this.deviceService.getHomeDataForUpdating(homeid);
  }

  /** Initialize MQTT client for cloud communication. */
  public async initializeMessageClient(device: Device, userdata: UserData): Promise<void> {
    await this.connectionService.initializeMessageClient(device, userdata);
    this.container.synchronizeMessageClients();
  }

  /** Initialize local network connection for a device. */
  public async initializeMessageClientForLocal(device: Device): Promise<boolean> {
    const result = await this.connectionService.initializeMessageClientForLocal(device);
    this.container.synchronizeMessageClients();
    return result;
  }

  /** Set callback for device status notifications. */
  public setDeviceNotify(callback: DeviceNotifyCallback): void {
    this.deviceNotify = callback;
    this.pollingService.setDeviceNotify(callback);
    this.connectionService.setDeviceNotify(callback);
  }

  /** Start polling device status via local network. */
  public activateDeviceNotify(device: Device): void {
    this.pollingService.activateDeviceNotifyOverLocal(device);
  }

  /** Stop service and clean up resources. */
  public stopService(): void {
    this.container.destroy();
  }

  // ============================================================================
  // Area Management Methods (delegate to AreaManagementService)
  // ============================================================================

  /** Set selected cleaning areas for a device. */
  public setSelectedAreas(duid: string, selectedAreas: number[]): void {
    this.areaService.setSelectedAreas(duid, selectedAreas);
  }

  /** Get selected cleaning areas for a device. */
  public getSelectedAreas(duid: string): number[] {
    return this.areaService.getSelectedAreas(duid);
  }

  /** Set supported cleaning areas (rooms) for a device. */
  public setSupportedAreas(duid: string, supportedAreas: ServiceArea.Area[]): void {
    this.areaService.setSupportedAreas(duid, supportedAreas);
  }

  /** Set area-to-room index mapping for a device. */
  public setSupportedAreaIndexMap(duid: string, indexMap: RoomIndexMap): void {
    this.areaService.setSupportedAreaIndexMap(duid, indexMap);
  }

  /** Set supported cleaning routines/scenes for a device. */
  public setSupportedScenes(duid: string, routineAsRooms: ServiceArea.Area[]): void {
    this.areaService.setSupportedScenes(duid, routineAsRooms);
  }

  /** Get supported cleaning areas for a device. */
  public getSupportedAreas(duid: string): ServiceArea.Area[] | undefined {
    return this.areaService.getSupportedAreas(duid);
  }

  /** Get area index map for a device. */
  public getSupportedAreasIndexMap(duid: string): RoomIndexMap | undefined {
    return this.areaService.getSupportedAreasIndexMap(duid);
  }

  /** Get map information for a device. */
  public async getMapInfo(duid: string): Promise<MapInfo> {
    return this.areaService.getMapInfo(duid);
  }

  /** Get room mapping for a device. */
  public async getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData> {
    return this.areaService.getRoomMap(duid, activeMap);
  }

  /** Get all scenes for a home. */
  public async getScenes(homeId: number): Promise<Scene[] | undefined> {
    return this.areaService.getScenes(homeId);
  }

  /** Start a cleaning scene/routine. */
  public async startScene(sceneId: number): Promise<unknown> {
    return this.areaService.startScene(sceneId);
  }

  // ============================================================================
  // Message Routing Methods (delegate to MessageRoutingService)
  // ============================================================================

  /** Get current cleaning mode settings. */
  public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
    return this.messageService.getCleanModeData(duid);
  }

  /** Get vacuum's current room from map. */
  public async getRoomIdFromMap(duid: string): Promise<number | undefined> {
    return this.messageService.getRoomIdFromMap(duid);
  }

  /** Change cleaning mode settings. */
  public async changeCleanMode(duid: string, settings: CleanModeSetting): Promise<void> {
    return this.messageService.changeCleanMode(duid, settings);
  }

  /** Start cleaning with selected areas. */
  public async startClean(duid: string): Promise<void> {
    const selectedAreas = this.areaService.getSelectedAreas(duid);
    const supportedRooms = this.areaService.getSupportedAreas(duid) ?? [];
    const supportedRoutines = this.areaService.getSupportedRoutines(duid) ?? [];

    return this.messageService.startClean(duid, selectedAreas, supportedRooms, supportedRoutines);
  }

  /** Pause cleaning. */
  public async pauseClean(duid: string): Promise<void> {
    return this.messageService.pauseClean(duid);
  }

  /** Stop cleaning and return to dock. */
  public async stopAndGoHome(duid: string): Promise<void> {
    return this.messageService.stopAndGoHome(duid);
  }

  /** Resume paused cleaning. */
  public async resumeClean(duid: string): Promise<void> {
    return this.messageService.resumeClean(duid);
  }

  public async stopClean(duid: string): Promise<void> {
    return this.messageService.stopClean(duid);
  }

  /** Play sound to locate vacuum. */
  public async playSoundToLocate(duid: string): Promise<void> {
    return this.messageService.playSoundToLocate(duid);
  }

  /** Execute custom GET request to device. */
  public async customGet<T = unknown>(duid: string, request: RequestMessage): Promise<T> {
    return this.messageService.customGet<T>(duid, request);
  }

  /** Send custom command to device (fire-and-forget). */
  public async customSend(duid: string, request: RequestMessage): Promise<void> {
    return this.messageService.customSend(duid, request);
  }

  /** Execute custom API GET request. */
  public async getCustomAPI<T = unknown>(url: string): Promise<T> {
    const iotApi = this.container.getIotApi();
    if (!iotApi) {
      throw new Error('IoT API not initialized. Please login first.');
    }
    return iotApi.getCustom(url) as Promise<T>;
  }
}
