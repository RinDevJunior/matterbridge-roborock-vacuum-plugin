import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailNotificationService } from '../../services/emailNotificationService.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { asType } from '../helpers/testUtils.js';
import type { EmailNotificationSettings } from '../../model/RoborockPluginPlatformConfig.js';

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

import nodemailer from 'nodemailer';

function createMockLogger(): AnsiLogger {
  return asType<AnsiLogger>({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    notice: vi.fn(),
    log: vi.fn(),
  });
}

function createSettings(overrides: Partial<EmailNotificationSettings> = {}): EmailNotificationSettings {
  return {
    smtpHost: 'smtp.example.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: 'user@example.com',
    smtpPassword: 'secret',
    recipient: 'recipient@example.com',
    ...overrides,
  };
}

describe('EmailNotificationService', () => {
  let mockLogger: AnsiLogger;
  let mockSendMail: ReturnType<typeof vi.fn>;
  let mockTransporter: { sendMail: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockSendMail = vi.fn().mockResolvedValue({ messageId: 'test-id' });
    mockTransporter = { sendMail: mockSendMail };
    vi.mocked(nodemailer.createTransport).mockReturnValue(mockTransporter as unknown as nodemailer.Transporter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('send', () => {
    it('should send email with correct subject and body', async () => {
      const service = new EmailNotificationService(createSettings(), mockLogger);

      await service.send('Test Subject', 'Test Body');

      expect(mockSendMail).toHaveBeenCalledOnce();
      expect(mockSendMail).toHaveBeenCalledWith({
        from: 'user@example.com',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        text: 'Test Body',
      });
    });

    it('should log error and not throw when sendMail fails', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection refused'));
      const service = new EmailNotificationService(createSettings(), mockLogger);

      await expect(service.send('Subject', 'Body')).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[EmailNotificationService] Failed to send email: SMTP connection refused',
      );
    });

    it('should log stringified non-Error rejection and not throw', async () => {
      mockSendMail.mockRejectedValue('timeout');
      const service = new EmailNotificationService(createSettings(), mockLogger);

      await expect(service.send('Subject', 'Body')).resolves.toBeUndefined();

      expect(mockLogger.error).toHaveBeenCalledWith('[EmailNotificationService] Failed to send email: timeout');
    });

    it('should use empty strings for from/recipient when smtpUser and recipient are undefined', async () => {
      const service = new EmailNotificationService(
        createSettings({ smtpUser: undefined, recipient: undefined }),
        mockLogger,
      );

      await service.send('Subject', 'Body');

      expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '', to: '' }));
    });
  });
});
