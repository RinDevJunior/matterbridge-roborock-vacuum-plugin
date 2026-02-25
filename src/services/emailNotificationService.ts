import nodemailer from 'nodemailer';
import type { AnsiLogger } from 'matterbridge/logger';
import type { EmailNotificationSettings } from '../model/RoborockPluginPlatformConfig.js';

export class EmailNotificationService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly recipient: string;

  public constructor(
    settings: EmailNotificationSettings,
    private readonly logger: AnsiLogger,
  ) {
    this.from = settings.smtpUser ?? '';
    this.recipient = settings.recipient ?? '';
    this.transporter = nodemailer.createTransport({
      host: settings.smtpHost,
      port: settings.smtpPort ?? 587,
      secure: settings.smtpSecure ?? false,
      auth: { user: settings.smtpUser, pass: settings.smtpPassword },
    });
  }

  public async send(subject: string, body: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to: this.recipient, subject, text: body });
    } catch (error) {
      this.logger.error(
        `[EmailNotificationService] Failed to send email: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
