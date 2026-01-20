import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { Device, DeviceStatusNotify } from '../roborockCommunication/index.js';
import { LOCAL_REFRESH_INTERVAL_MULTIPLIER, MQTT_REFRESH_INTERVAL_MULTIPLIER } from '../constants/index.js';
import { NotifyMessageTypes } from '../notifyMessageTypes.js';
import { MessageRoutingService } from './messageRoutingService.js';
import { DeviceNotifyCallback } from '@/types/index.js';

/** Polls device status via local network or MQTT. */
export class PollingService {
  private localRequestDeviceStatusInterval: NodeJS.Timeout | undefined;
  private mqttRequestDeviceStatusInterval: NodeJS.Timeout | undefined;
  private deviceNotify?: DeviceNotifyCallback;

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
        const messageProcessor = this.messageRoutingService.getMessageProcessor(device.duid);
        if (!messageProcessor) {
          this.logger.error('Local Polling - No message processor for device:', device.duid);
          return;
        }

        const response = await messageProcessor.getDeviceStatus(device.duid);
        if (response && this.deviceNotify) {
          const message = { duid: device.duid, ...response.errorStatus, ...response.message } as DeviceStatusNotify;
          this.logger.debug('Local Polling - Device status update:', debugStringify(message));
          this.deviceNotify(NotifyMessageTypes.LocalMessage, message);
        }
      } catch (error) {
        this.logger.error('Failed to get device status:', error);
      }
    }, this.refreshInterval * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
  }

  /** Start polling device status via MQTT. */
  activateDeviceNotifyOverMQTT(device: Device): void {
    if (!this.deviceNotify) {
      this.logger.warn('Cannot activate device notify over MQTT: deviceNotify callback not set');
      return;
    }

    // Clear any existing interval before creating a new one
    this.stopMqttPolling();

    this.logger.notice('Requesting device info for device over MQTT', device.duid);

    this.mqttRequestDeviceStatusInterval = setInterval(async () => {
      try {
        const messageProcessor = this.messageRoutingService.getMessageProcessor(device.duid);
        if (!messageProcessor) {
          this.logger.error('MQTT - No message processor for device:', device.duid);
          return;
        }

        const response = await messageProcessor.getDeviceStatusOverMQTT(device.duid);
        if (response && this.deviceNotify) {
          const message = { duid: device.duid, ...response.errorStatus, ...response.message } as DeviceStatusNotify;
          this.logger.debug('MQTT - Device status update', debugStringify(message));
          this.deviceNotify(NotifyMessageTypes.LocalMessage, message);
        }
      } catch (error) {
        this.logger.error('Failed to get device status over MQTT:', error);
      }
    }, this.refreshInterval * MQTT_REFRESH_INTERVAL_MULTIPLIER);
  }

  /** Stop all polling intervals. */
  stopPolling(): void {
    this.stopLocalPolling();
    this.stopMqttPolling();
  }

  private stopLocalPolling(): void {
    if (this.localRequestDeviceStatusInterval !== undefined) {
      clearInterval(this.localRequestDeviceStatusInterval);
      this.localRequestDeviceStatusInterval = undefined;
    }
  }

  private stopMqttPolling(): void {
    if (this.mqttRequestDeviceStatusInterval !== undefined) {
      clearInterval(this.mqttRequestDeviceStatusInterval);
      this.mqttRequestDeviceStatusInterval = undefined;
    }
  }

  /** Cleanup and shutdown. */
  async shutdown(): Promise<void> {
    this.stopPolling();
    this.deviceNotify = undefined;
  }
}
