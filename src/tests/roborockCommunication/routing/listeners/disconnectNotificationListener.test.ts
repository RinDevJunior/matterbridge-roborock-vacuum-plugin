import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DisconnectNotificationListener } from '../../../../roborockCommunication/routing/listeners/implementation/disconnectNotificationListener.js';
import { EmailNotificationService } from '../../../../services/emailNotificationService.js';
import type { AnsiLogger } from 'matterbridge/logger';
import { asPartial, asType } from '../../../helpers/testUtils.js';

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

function createMockEmailService(): EmailNotificationService {
  return asPartial<EmailNotificationService>({
    send: vi.fn().mockResolvedValue(undefined),
  });
}

describe('DisconnectNotificationListener', () => {
  let mockLogger: AnsiLogger;
  let mockEmailService: EmailNotificationService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockEmailService = createMockEmailService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onDisconnected', () => {
    it('should call emailService.send with correct subject for Local connection type', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'Local');

      await listener.onDisconnected('device-001', 'socket closed');

      expect(mockEmailService.send).toHaveBeenCalledOnce();
      const [subject, body] = vi.mocked(mockEmailService.send).mock.calls[0];
      expect(subject).toBe('[Roborock] Local connection dropped: device-001');
      expect(body).toContain('device-001');
      expect(body).toContain('Local');
      expect(body).toContain('socket closed');
    });

    it('should call emailService.send with correct subject for MQTT connection type', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'MQTT');

      await listener.onDisconnected('device-002', 'broker offline');

      expect(mockEmailService.send).toHaveBeenCalledOnce();
      const [subject, body] = vi.mocked(mockEmailService.send).mock.calls[0];
      expect(subject).toBe('[Roborock] MQTT connection dropped: device-002');
      expect(body).toContain('device-002');
      expect(body).toContain('MQTT');
      expect(body).toContain('broker offline');
    });

    it('should log a warning when disconnected', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'Local');

      await listener.onDisconnected('device-001', 'socket closed');

      expect(mockLogger.warn).toHaveBeenCalledOnce();
    });
  });

  describe('no-op handlers', () => {
    it('onConnected should not call emailService.send', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'Local');

      await listener.onConnected('device-001');

      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('onError should not call emailService.send', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'Local');

      await listener.onError('device-001', 'some error');

      expect(mockEmailService.send).not.toHaveBeenCalled();
    });

    it('onReconnect should not call emailService.send', async () => {
      const listener = new DisconnectNotificationListener(mockEmailService, mockLogger, 'Local');

      await listener.onReconnect('device-001', 'reconnected');

      expect(mockEmailService.send).not.toHaveBeenCalled();
    });
  });
});
