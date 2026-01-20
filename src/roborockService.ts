import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { RoborockAuthenticateApi, UserData, RoborockIoTApi, ClientRouter, MessageProcessor, Device, Home, RequestMessage, Scene, MapInfo } from './roborockCommunication/index.js';
import { RoomIndexMap } from './model/RoomIndexMap.js';
import { CleanModeDTO } from './behaviors/index.js';
import type { Factory } from './types/index.js';
import { NotifyMessageTypes } from './notifyMessageTypes.js';
import {
  ServiceContainer,
  ServiceContainerConfig,
  AuthenticationService,
  DeviceManagementService,
  AreaManagementService,
  MessageRoutingService,
  PollingService,
  ClientManager,
  SaveUserDataCallback,
} from './services/index.js';

/** Facade coordinating Auth, Device, Area, and Message services via ServiceContainer. */
export default class RoborockService {
  private readonly container: ServiceContainer;
  private readonly authService: AuthenticationService;
  private readonly deviceService: DeviceManagementService;
  private readonly areaService: AreaManagementService;
  private readonly messageService: MessageRoutingService;
  private readonly pollingService: PollingService;

  // Public properties exposed for backward compatibility
  public messageClient: ClientRouter | undefined;
  public deviceNotify?: (messageSource: NotifyMessageTypes, homeData: unknown) => void;

  constructor(
    authenticateApiSupplier: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi = (logger, baseUrl) =>
      new RoborockAuthenticateApi(logger, undefined, undefined, baseUrl),
    iotApiSupplier: Factory<UserData, RoborockIoTApi> = (logger, ud) => new RoborockIoTApi(ud, logger),
    refreshInterval: number,
    clientManager: ClientManager,
    logger: AnsiLogger,
    baseUrl = 'https://usiot.roborock.com',
    // Allow injecting ServiceContainer for testing
    container?: ServiceContainer,
  ) {
    if (container) {
      // Use injected container (for testing)
      this.container = container;
    } else {
      // Create service container with configuration (production)
      const config: ServiceContainerConfig = {
        baseUrl,
        refreshInterval,
        authenticateApiFactory: authenticateApiSupplier,
        iotApiFactory: iotApiSupplier,
      };
      this.container = new ServiceContainer(logger, clientManager, config);
    }

    // Get service instances
    this.authService = this.container.getAuthenticationService();
    this.deviceService = this.container.getDeviceManagementService();
    this.areaService = this.container.getAreaManagementService();
    this.messageService = this.container.getMessageRoutingService();
    this.pollingService = this.container.getPollingService();
  }

  // ============================================================================
  // Authentication Methods (delegate to AuthenticationService)
  // ============================================================================

  /**
   * @deprecated Use requestVerificationCode and loginWithVerificationCode instead
   */
  public async loginWithPassword(
    username: string,
    password: string,
    loadSavedUserData: () => Promise<UserData | undefined>,
    savedUserData: (userData: UserData) => Promise<void>,
  ): Promise<UserData> {
    const userdata = await this.authService.loginWithPassword(username, password, loadSavedUserData, savedUserData);
    this.container.setUserData(userdata);
    return userdata;
  }

  /** Request verification code for email login. */
  public async requestVerificationCode(email: string): Promise<void> {
    return this.authService.requestVerificationCode(email);
  }

  /** Authenticate with email and verification code. */
  public async loginWithVerificationCode(email: string, code: string, savedUserData: SaveUserDataCallback): Promise<UserData> {
    const userdata = await this.authService.loginWithVerificationCode(email, code, savedUserData);
    this.container.setUserData(userdata);
    return userdata;
  }

  /** Authenticate using cached token from previous login. */
  public async loginWithCachedToken(username: string, userData: UserData): Promise<UserData> {
    const userdata = await this.authService.loginWithCachedToken(username, userData);
    this.container.setUserData(userdata);
    return userdata;
  }

  // ============================================================================
  // Device Management Methods (delegate to DeviceManagementService)
  // ============================================================================

  /** List all devices for the user's account. */
  public async listDevices(username: string): Promise<Device[]> {
    return this.deviceService.listDevices(username);
  }

  /** Get home data for periodic updates. */
  public async getHomeDataForUpdating(homeid: number): Promise<Home | undefined> {
    return this.deviceService.getHomeDataForUpdating(homeid);
  }

  /** Initialize MQTT client for cloud communication. */
  public async initializeMessageClient(username: string, device: Device, userdata: UserData): Promise<void> {
    await this.deviceService.initializeMessageClient(username, device, userdata);
    this.messageClient = this.deviceService.messageClient;
  }

  /** Initialize local network connection for a device. */
  public async initializeMessageClientForLocal(device: Device): Promise<boolean> {
    const result = await this.deviceService.initializeMessageClientForLocal(device);
    this.messageClient = this.deviceService.messageClient;
    return result;
  }

  /** Set callback for device status notifications. */
  public setDeviceNotify(callback: (messageSource: NotifyMessageTypes, homeData: unknown) => Promise<void>): void {
    this.deviceNotify = callback;
    this.pollingService.setDeviceNotify(callback);
    this.deviceService.setDeviceNotify(callback);
  }

  /** Start polling device status via local network. */
  public activateDeviceNotify(device: Device): void {
    this.pollingService.activateDeviceNotifyOverLocal(device);
  }

  /** Start polling device status via MQTT. */
  public activateDeviceNotifyOverMQTT(device: Device): void {
    this.pollingService.activateDeviceNotifyOverMQTT(device);
  }

  /** Stop service and clean up resources. */
  public stopService(): void {
    this.deviceService.stopService();
    this.pollingService.stopPolling();
    this.areaService.clearAll();
    this.messageService.clearAll();
    this.messageClient = undefined;
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
  public async getMapInformation(duid: string): Promise<MapInfo | undefined> {
    // Set message client if not already set
    if (!this.messageClient) {
      throw new Error('Message client not initialized. Please initialize before fetching map information.');
    }
    this.areaService.setMessageClient(this.messageClient);
    return this.areaService.getMapInformation(duid);
  }

  /** Get room mappings for a device. */
  public async getRoomMappings(duid: string): Promise<number[][] | undefined> {
    // Set message client if not already set
    if (this.messageClient) {
      this.areaService.setMessageClient(this.messageClient);
    }
    const mqttOnly = this.messageService.getMqttAlwaysOn(duid);
    return this.areaService.getRoomMappings(duid, mqttOnly);
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

  /** Get message processor for a device. */
  public getMessageProcessor(duid: string): MessageProcessor {
    return this.messageService.getMessageProcessor(duid);
  }

  /** Get current cleaning mode settings. */
  public async getCleanModeData(duid: string): Promise<CleanModeDTO> {
    return this.messageService.getCleanModeData(duid);
  }

  /** Get vacuum's current room from map. */
  public async getRoomIdFromMap(duid: string): Promise<number | undefined> {
    return this.messageService.getRoomIdFromMap(duid);
  }

  /** Change cleaning mode settings. */
  public async changeCleanMode(duid: string, settings: CleanModeDTO): Promise<void> {
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
