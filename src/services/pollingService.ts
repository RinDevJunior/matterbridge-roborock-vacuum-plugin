import { AnsiLogger } from 'matterbridge/logger';
import { LOCAL_REFRESH_INTERVAL_MULTIPLIER } from '../constants/index.js';
import { MessageRoutingService } from './messageRoutingService.js';
import { Device } from '../roborockCommunication/models/index.js';
import { DeviceNotifyCallback } from '../types/index.js';

/** Polls device status via local network or MQTT. */
export class PollingService {
  private localRequestDeviceStatusInterval: NodeJS.Timeout | undefined;
  private deviceNotify: DeviceNotifyCallback | undefined;

  constructor(
    private readonly refreshInterval: number,
    private readonly logger: AnsiLogger,
    private readonly messageRoutingService: MessageRoutingService,
  ) {}

  /** Set callback for device status updates. */
  setDeviceNotify(callback: DeviceNotifyCallback): void {
    this.deviceNotify = callback;
  }

  /** Start polling device status via local UDP. */
  activateDeviceNotifyOverLocal(device: Device): void {
    if (!this.deviceNotify) {
      this.logger.warn('Cannot activate device notify over local: deviceNotify callback not set');
      return;
    }

    // Clear any existing interval
    this.stopLocalPolling();

    this.logger.debug('Activating device status polling for:', device.duid);

    this.localRequestDeviceStatusInterval = setInterval(async () => {
      try {
        const messageDispatcher = this.messageRoutingService.getMessageDispatcher(device.duid);
        if (!messageDispatcher) {
          this.logger.error('Local Polling - No message dispatcher for device:', device.duid);
          return;
        }

        await messageDispatcher.getDeviceStatus(device.duid);
      } catch (error) {
        this.logger.error('Failed to get device status:', error);
      }
    }, this.refreshInterval * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
  }

  /** Stop all polling intervals. */
  stopPolling(): void {
    this.stopLocalPolling();
  }

  private stopLocalPolling(): void {
    if (this.localRequestDeviceStatusInterval !== undefined) {
      clearInterval(this.localRequestDeviceStatusInterval);
      this.localRequestDeviceStatusInterval = undefined;
    }
  }

  /** Cleanup and shutdown. */
  async shutdown(): Promise<void> {
    this.stopPolling();
    this.deviceNotify = undefined;
  }
}
