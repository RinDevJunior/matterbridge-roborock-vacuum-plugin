import { WATCHDOG_CHECK_INTERVAL_MS, WATCHDOG_THRESHOLD_MS } from './constants/index.js';
import { RoborockMatterbridgePlatform } from './module.js';
import { BurstPollingManager } from './platform/burstPollingManager.js';
import { updateFromHomeData } from './runtimes/handleHomeDataMessage.js';
import { handleBatteryUpdate } from './runtimes/handlers/batteryStateHandler.js';
import { handleCleanModeUpdate } from './runtimes/handlers/cleanModeHandler.js';
import { handleDeviceStatusSimpleUpdate, handleDeviceStatusUpdate } from './runtimes/handlers/deviceStateHandler.js';
import { handleErrorOccurred } from './runtimes/handlers/errorStateHandler.js';
import { handleActiveMapChanged, handleServiceAreaUpdate } from './runtimes/handlers/serviceAreaHandler.js';
import type { MessagePayload } from './types/MessagePayloads.js';
import { NotifyMessageTypes } from './types/notifyMessageTypes.js';
import type { RoborockVacuumCleaner } from './types/roborockVacuumCleaner.js';

type RobotHandler<T = unknown> = (robot: RoborockVacuumCleaner, data: T) => void | Promise<void>;

export class PlatformRunner {
	private activateHandlers = false;
	private watchdogTimer: NodeJS.Timeout | undefined;

	public readonly burstPolling: BurstPollingManager;

	constructor(private readonly platform: RoborockMatterbridgePlatform) {
		this.burstPolling = new BurstPollingManager(platform);
	}

	public startWatchdog(): void {
		this.watchdogTimer = setInterval(() => {
			const threshold = Date.now() - WATCHDOG_THRESHOLD_MS;
			for (const robot of this.platform.registry.robotsMap.values()) {
				if (robot.lastUpdateAt !== null && robot.lastUpdateAt < threshold) {
					this.platform.log.error(
						`[${robot.device.duid}] [${robot.device.name}] No status update received in the last ${WATCHDOG_THRESHOLD_MS / 60_000} minutes`,
					);
				}
			}
		}, WATCHDOG_CHECK_INTERVAL_MS);
	}

	public stopWatchdog(): void {
		if (this.watchdogTimer) {
			clearInterval(this.watchdogTimer);
			this.watchdogTimer = undefined;
		}
	}

	public activateHandlerFunctions(): void {
		this.activateHandlers = true;
	}

	/**
	 * Request and process home data update from Roborock service.
	 * Fetches latest home data including device states and triggers robot state updates.
	 * Returns early if no robots configured, no home ID set, or service unavailable.
	 */
	public async requestHomeData(): Promise<void> {
		const platform = this.platform;
		if (platform.registry.robotsMap.size === 0 || !platform.rrHomeId) return;
		if (platform.roborockService === undefined) return;

		const robots = [...platform.registry.robotsMap.values()];
		const threshold = Date.now() - WATCHDOG_THRESHOLD_MS;
		const allDevicesFresh = robots.every(
			(x) => x.device.specs.hasRealTimeConnection && x.lastUpdateAt !== null && x.lastUpdateAt > threshold,
		);
		if (allDevicesFresh) return;

		const homeData = await platform.roborockService.getHomeDataForUpdating(platform.rrHomeId);
		if (homeData === undefined) return;
		await this.updateRobotWithPayload({ type: NotifyMessageTypes.HomeData, data: homeData });
	}

	/**
	 * Update robot state based on message payload.
	 * Routes to appropriate handler using type-safe discriminated unions.
	 */
	public async updateRobotWithPayload(payload: MessagePayload): Promise<void> {
		if (!this.activateHandlers) return;

		const { type } = payload;
		switch (type) {
			case NotifyMessageTypes.ErrorOccurred:
				await this.executeWithRobot(payload.data.duid, payload.data, (robot, data) =>
					handleErrorOccurred(robot, data, this.platform),
				);
				break;
			case NotifyMessageTypes.BatteryUpdate:
				await this.executeWithRobot(payload.data.duid, payload.data, (robot, data) =>
					handleBatteryUpdate(robot, data, this.platform),
				);
				break;
			case NotifyMessageTypes.DeviceStatus:
				await this.executeWithRobot(payload.data.duid, payload.data, async (robot, data) => {
					const shouldBurst = await handleDeviceStatusUpdate(robot, data, this.platform);
					if (shouldBurst && !this.burstPolling.has(robot.device.duid)) {
						this.burstPolling.startBurstPolling(robot.device.duid);
					}
				});
				break;
			case NotifyMessageTypes.DeviceStatusSimple:
				await this.executeWithRobot(payload.data.duid, payload.data, (robot, data) =>
					handleDeviceStatusSimpleUpdate(robot, data, this.platform),
				);
				break;
			case NotifyMessageTypes.CleanModeUpdate:
				await this.executeWithRobot(payload.data.duid, payload.data, (robot, data) =>
					handleCleanModeUpdate(robot, data, this.platform),
				);
				break;
			case NotifyMessageTypes.ServiceAreaUpdate:
				await this.executeWithRobot(payload.data.duid, payload.data, (robot, data) =>
					handleServiceAreaUpdate(robot, data, this.platform),
				);
				break;
			case NotifyMessageTypes.HomeData:
				await updateFromHomeData(payload.data, this.platform);
				break;
			case NotifyMessageTypes.ActiveMapChanged:
				await this.executeWithRobot(payload.data.duid, payload.data, async (robot, data) => {
					if (robot.homeInFo.activeMapId === data.mapId) return;
					robot.homeInFo.activeMapId = data.mapId;
					await handleActiveMapChanged(robot, data.mapId, this.platform);
				});
				break;
			default:
				this.platform.log.warn(`No handler registered for message type: ${type}`);
		}
	}

	/**
	 * Template method: Execute handler with robot instance.
	 * Handles robot lookup, error logging, and passes data to handler.
	 */
	private async executeWithRobot<T>(duid: string, data: T, handler: RobotHandler<T>): Promise<void> {
		const robot = this.getRobotOrLogError(duid);
		if (!robot) return;
		await handler(robot, data);
		robot.lastUpdateAt = Date.now();
	}

	/**
	 * Get robot by DUID or log error if not found.
	 */
	private getRobotOrLogError(duid: string): RoborockVacuumCleaner | undefined {
		const robot = this.platform.registry.getRobot(duid);
		if (!robot) {
			this.platform.log.error(`Robot with DUID ${duid} not found`);
		}
		return robot;
	}
}
