import type { AnsiLogger } from 'matterbridge/logger';
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { EmailNotificationService } from '../../../../services/emailNotificationService.js';

export type ConnectionType = 'Local' | 'MQTT';

export class DisconnectNotificationListener implements AbstractConnectionListener {
  public constructor(
    private readonly emailService: EmailNotificationService,
    private readonly logger: AnsiLogger,
    private readonly connectionType: ConnectionType,
  ) {}

  public async onDisconnected(duid: string, message: string): Promise<void> {
    this.logger.warn(
      `[DisconnectNotificationListener] ${duid} ${this.connectionType} disconnected — sending email notification`,
    );
    await this.emailService.send(
      `[Roborock] ${this.connectionType} connection dropped: ${duid}`,
      `Device ${duid} lost its ${this.connectionType} connection.\n\nReason: ${message}\nTime: ${new Date().toISOString()}`,
    );
  }

  public async onConnected(_duid: string): Promise<void> {}
  public async onError(_duid: string, _message: string): Promise<void> {}
  public async onReconnect(_duid: string, _message: string): Promise<void> {}
}
