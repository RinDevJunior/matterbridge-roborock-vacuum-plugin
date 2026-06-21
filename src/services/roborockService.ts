import { AnsiLogger } from 'matterbridge/logger';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { LocalStorage } from 'node-persist';

import { CleanModeSetting } from '../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { SCENE_AREA_ID_MIN } from '../constants/index.js';
import { RoomIndexMap } from '../core/application/models/index.js';
import { AuthenticationResponse } from '../model/AuthenticationResponse.js';
import { CleanCommand } from '../model/CleanCommand.js';
import { PlatformConfigManager } from '../platform/platformConfigManager.js';
import { RoborockAuthenticateApi } from '../roborockCommunication/api/authClient.js';
import { RoborockIoTApi } from '../roborockCommunication/api/iotClient.js';
import { Device, Home, Scene, UserData } from '../roborockCommunication/models/index.js';
import {
	AreaManagementService,
	ConnectionService,
	DeviceManagementService,
	MessageRoutingService,
	PollingService,
	ServiceContainer,
	ServiceContainerConfig,
} from '../services/index.js';
import { DeviceNotifyCallback, Factory } from '../types/index.js';
import { WssSendSnackbarMessage } from '../types/WssSendSnackbarMessage.js';
import { AuthenticationCoordinator } from './authentication/AuthenticationCoordinator.js';

export interface RoborockServiceConfig {
	authenticateApiFactory?: (logger: AnsiLogger, baseUrl: string) => RoborockAuthenticateApi;
	iotApiFactory?: Factory<UserData, RoborockIoTApi>;
	refreshInterval: number;
	baseUrl: string;
	persist: LocalStorage;
	configManager: PlatformConfigManager;
	container?: ServiceContainer;
	toastMessage: WssSendSnackbarMessage;
}

/** Facade coordinating Auth, Device, Area, and Message services via ServiceContainer. */
export class RoborockService {
	private readonly container: ServiceContainer;
	private readonly authCoordinator: AuthenticationCoordinator;
	private readonly deviceService: DeviceManagementService;
	private readonly areaService: AreaManagementService;
	private readonly messageRoutingService: MessageRoutingService;
	private readonly pollingService: PollingService;
	private readonly connectionService: ConnectionService;
	private readonly toastMessage: WssSendSnackbarMessage;

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
				toastMessage: params.toastMessage,
			};
			this.container = new ServiceContainer(logger, config);
		}

		// Get service instances
		this.authCoordinator = this.container.getAuthenticationCoordinator();
		this.deviceService = this.container.getDeviceManagementService();
		this.areaService = this.container.getAreaManagementService();
		this.messageRoutingService = this.container.getMessageRoutingService();
		this.pollingService = this.container.getPollingService();
		this.connectionService = this.container.getConnectionService();
		this.toastMessage = params.toastMessage;
	}

	public async authenticate(): Promise<AuthenticationResponse> {
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
			this.toastMessage(`Authentication failed: ${(error as Error).message}`, 5000, 'error');
			return { userData: undefined, shouldContinue: false, isSuccess: false };
		}

		if (!userData) {
			this.logger.info('Authentication incomplete. Further action required (e.g., 2FA).');
			this.toastMessage('Authentication incomplete. Further action required (e.g., 2FA).', 5000, 'warning');
			return { userData: undefined, shouldContinue: false, isSuccess: false };
		}

		this.logger.info(`Authentication successful for user: ${userData.nickname} (${userData.username})`);
		this.toastMessage(`Authentication successful for user: ${userData.username}`, 5000, 'success');
		this.container.setUserData(userData);
		return { userData, shouldContinue: true, isSuccess: true };
	}

	/** List all devices for the user's account. */
	public async listDevices(): Promise<Device[]> {
		return this.deviceService.listDevices();
	}

	public async getSerialNumber(duid: string): Promise<string> {
		return this.messageRoutingService.getSerialNumber(duid);
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

	/** Send a test email to verify email notification settings. */
	public async sendTestEmailNotification(): Promise<void> {
		await this.connectionService.sendTestEmailNotification();
	}

	/** Set callback for device status notifications. */
	public setDeviceNotify(callback: DeviceNotifyCallback): void {
		this.deviceNotify = callback;
		this.connectionService.setDeviceNotify(callback);
	}

	/** Start polling device status via local network. */
	public activateDeviceNotify(device: Device): void {
		this.pollingService.activateDeviceNotifyOverLocal(device);
	}

	/** Trigger a one-shot local/MQTT status request for a device. */
	public async requestDeviceStatusOnce(duid: string): Promise<void> {
		await this.pollingService.requestStatusOnce(duid);
	}

	/** Stop service and clean up resources. */
	public stopService(): void {
		this.container.destroy();
	}

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
	public setSupportedRoutines(duid: string, routineAsRooms: ServiceArea.Area[]): void {
		this.areaService.setSupportedRoutines(duid, routineAsRooms);
	}

	/** Get supported cleaning areas for a device. */
	public getSupportedAreas(duid: string): ServiceArea.Area[] {
		return this.areaService.getSupportedAreas(duid);
	}

	/** Get area index map for a device. */
	public getSupportedAreasIndexMap(duid: string): RoomIndexMap | undefined {
		return this.areaService.getSupportedAreasIndexMap(duid);
	}

	/** Get map information for a device. */
	public async getMapInfo(duid: string): Promise<void> {
		await this.areaService.getMapInfo(duid);
	}

	/** Get room mapping for a device. */
	public async getRoomMap(duid: string, activeMap: number): Promise<void> {
		await this.areaService.getRoomMap(duid, activeMap);
	}

	/** Get all scenes for a home. */
	public async getScenes(homeId: number): Promise<Scene[] | undefined> {
		return this.areaService.getScenes(homeId);
	}

	/** Start a cleaning scene/routine. */
	public async startScene(sceneId: number): Promise<unknown> {
		return this.areaService.startScene(sceneId);
	}

	/** Get current cleaning mode settings. */
	public async getCleanModeData(duid: string): Promise<CleanModeSetting> {
		return this.messageRoutingService.getCleanModeData(duid);
	}

	/** Change cleaning mode settings. */
	public async changeCleanMode(duid: string, settings: CleanModeSetting): Promise<void> {
		return this.messageRoutingService.changeCleanMode(duid, settings);
	}

	/** Start cleaning with selected areas. */
	public async startClean(duid: string): Promise<void> {
		const command = this.buildCleanCommand(duid);
		return this.messageRoutingService.startClean(duid, command);
	}

	/** Pause cleaning. */
	public async pauseClean(duid: string): Promise<void> {
		return this.messageRoutingService.pauseClean(duid);
	}

	/** Stop cleaning and return to dock. */
	public async stopAndGoHome(duid: string): Promise<void> {
		return this.messageRoutingService.stopAndGoHome(duid);
	}

	/** Resume paused cleaning. */
	public async resumeClean(duid: string): Promise<void> {
		return this.messageRoutingService.resumeClean(duid);
	}

	public async stopClean(duid: string): Promise<void> {
		return this.messageRoutingService.stopClean(duid);
	}

	/** Play sound to locate vacuum. */
	public async playSoundToLocate(duid: string): Promise<void> {
		return this.messageRoutingService.playSoundToLocate(duid);
	}

	private buildCleanCommand(duid: string): CleanCommand {
		const selectedAreaIds = this.areaService.getSelectedAreas(duid);
		const supportedRooms = this.areaService.getSupportedAreas(duid) ?? [];
		const supportedRoutines = this.areaService.getSupportedRoutines(duid) ?? [];
		const indexMap = this.areaService.getSupportedAreasIndexMap(duid);

		const selectedRoutines = selectedAreaIds
			.map((areaId) => supportedRoutines.find((r) => r.areaId === areaId))
			.filter((area): area is ServiceArea.Area => area !== undefined)
			.sort((a, b) =>
				(a.areaInfo.locationInfo?.locationName ?? '').localeCompare(b.areaInfo.locationInfo?.locationName ?? ''),
			);

		if (selectedRoutines.length > 0) {
			return { type: 'routine', routineId: selectedRoutines[0].areaId - SCENE_AREA_ID_MIN };
		}

		const activeMapId = supportedRooms.find((r) => selectedAreaIds.includes(r.areaId))?.mapId;
		const activeMapRooms = activeMapId != null ? supportedRooms.filter((r) => r.mapId === activeMapId) : supportedRooms;

		const roomIds = selectedAreaIds
			.filter((areaId) => supportedRooms.some((r) => r.areaId === areaId))
			.map((areaId) => indexMap?.getRoomId(areaId))
			.filter((id): id is number => id !== undefined);

		if (roomIds.length === 0 || roomIds.length === activeMapRooms.length || activeMapRooms.length === 0) {
			return { type: 'global' };
		}

		return { type: 'room', roomIds };
	}
}
