# Email Notification on Connection Drop — Implementation Plan

## Overview

Send an email alert when a device connection drops — both **local network** (unintentional socket close/error) and **MQTT** disconnects. The feature is opt-in under Advanced Features, configured with SMTP credentials and a recipient address.

---

## Scope

| Trigger                                                      | Fires email? |
| ------------------------------------------------------------ | ------------ |
| Local socket close/error (`intentionalDisconnect === false`) | ✅ Yes       |
| MQTT broker disconnect / offline                             | ✅ Yes       |
| Intentional disconnect (reconnect cycle)                     | ❌ No        |
| Initial connection failure (never connected)                 | ❌ No        |

---

## Listener Architecture

Instead of two separate listener classes, a single `DisconnectNotificationListener` is registered on **both** `LocalNetworkClient.connectionBroadcaster` and `MQTTClient.connectionBroadcaster`. The email subject distinguishes the connection type.

---

## Files to Create

### `src/services/emailNotificationService.ts`

- Wraps `nodemailer` transporter
- `send(subject: string, body: string): Promise<void>` — fire-and-forget with error logging
- Instantiated once from `PlatformConfigManager` settings

### `src/roborockCommunication/routing/listeners/implementation/disconnectNotificationListener.ts`

- Implements `AbstractConnectionListener`
- Constructor takes `EmailNotificationService`, `AnsiLogger`, and `connectionType: 'Local' | 'MQTT'`
- `onDisconnected(duid, message)`: sends email with connection type in subject
- `onConnected`, `onError`, `onReconnect`: no-ops

---

## Files to Modify

### `package.json`

- Add `nodemailer` to `dependencies`
- Add `@types/nodemailer` to `devDependencies`

### `matterbridge-roborock-vacuum-plugin.schema.json`

Add new `emailNotification` object under `advancedFeature.settings`:

```json
"emailNotification": {
  "title": "Email Notification on Disconnect",
  "type": "object",
  "properties": {
    "enabled": {
      "title": "Enable email notification when connection drops",
      "type": "boolean",
      "default": false
    }
  },
  "allOf": [
    {
      "if": { "properties": { "enabled": { "const": true } }, "required": ["enabled"] },
      "then": {
        "properties": {
          "smtpHost":     { "title": "SMTP Host",          "type": "string" },
          "smtpPort":     { "title": "SMTP Port",          "type": "number", "default": 587 },
          "smtpSecure":   { "title": "Use TLS (port 465)", "type": "boolean", "default": false },
          "smtpUser":     { "title": "SMTP Username",      "type": "string" },
          "smtpPassword": { "title": "SMTP Password",      "type": "string", "x-secret": true },
          "recipient":    { "title": "Recipient email",    "type": "string" }
        },
        "required": ["smtpHost", "smtpUser", "smtpPassword", "recipient"]
      }
    }
  ]
}
```

### `matterbridge-roborock-vacuum-plugin.config.json`

- Add `emailNotification: { enabled: false }` under `advancedFeature.settings`

### `src/types/roborockPluginPlatformConfig.ts`

- Add `EmailNotificationSettings` interface
- Add `emailNotification?: EmailNotificationSettings` to `AdvancedFeatureSetting`

### `src/platform/platformConfigManager.ts`

- Add getter: `get emailNotificationSettings(): EmailNotificationSettings | undefined`
- Add getter: `get isEmailNotificationEnabled(): boolean`

### `src/services/connectionService.ts`

- Create `EmailNotificationService` once when config is enabled
- Register `DisconnectNotificationListener('Local')` on each local client after setup
- Register `DisconnectNotificationListener('MQTT')` on the MQTT client after setup

---

## Interfaces

```typescript
// src/types/roborockPluginPlatformConfig.ts
export interface EmailNotificationSettings {
  enabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  recipient?: string;
}
```

---

## Implementation Details

### `EmailNotificationService`

```typescript
import nodemailer from 'nodemailer';
import { AnsiLogger } from 'matterbridge/logger';
import { EmailNotificationSettings } from '../../types/roborockPluginPlatformConfig.js';

export class EmailNotificationService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly recipient: string;

  constructor(settings: EmailNotificationSettings, private readonly logger: AnsiLogger) {
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
```

### `DisconnectNotificationListener`

```typescript
import { AbstractConnectionListener } from '../abstractConnectionListener.js';
import { EmailNotificationService } from '../../../services/emailNotificationService.js';
import { AnsiLogger } from 'matterbridge/logger';

export type ConnectionType = 'Local' | 'MQTT';

export class DisconnectNotificationListener implements AbstractConnectionListener {
  constructor(
    private readonly emailService: EmailNotificationService,
    private readonly logger: AnsiLogger,
    private readonly connectionType: ConnectionType,
  ) {}

  public async onDisconnected(duid: string, message: string): Promise<void> {
    this.logger.warn(`[DisconnectNotificationListener] ${duid} ${this.connectionType} disconnected — sending email`);
    await this.emailService.send(
      `[Roborock] ${this.connectionType} connection dropped: ${duid}`,
      `Device ${duid} lost its ${this.connectionType} connection.\n\nReason: ${message}\nTime: ${new Date().toISOString()}`,
    );
  }

  public async onConnected(_duid: string): Promise<void> {}
  public async onError(_duid: string, _message: string): Promise<void> {}
  public async onReconnect(_duid: string, _message: string): Promise<void> {}
}
```

### Registration in `ConnectionService`

```typescript
// Shared instance (create once)
private emailService: EmailNotificationService | undefined;

private getEmailService(): EmailNotificationService | undefined {
  if (!this.configManager.isEmailNotificationEnabled) return undefined;
  this.emailService ??= new EmailNotificationService(this.configManager.emailNotificationSettings!, this.logger);
  return this.emailService;
}

// In setupLocalClient() — after local client is created:
const emailService = this.getEmailService();
if (emailService) {
  localClient.registerConnectionListener(
    new DisconnectNotificationListener(emailService, this.logger, 'Local'),
  );
}

// In initializeMessageClient() — after MQTT client is created:
const emailService = this.getEmailService();
if (emailService) {
  mqttClient.registerConnectionListener(
    new DisconnectNotificationListener(emailService, this.logger, 'MQTT'),
  );
}
```

---

## Unit Tests to Add

| File                                                                         | Tests                                                                                                                |
| ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `src/tests/services/emailNotificationService.test.ts`                        | send success, send failure (logs error and does not throw)                                                           |
| `src/tests/roborockCommunication/.../disconnectNotificationListener.test.ts` | onDisconnected calls emailService.send with correct subject (Local/MQTT), onConnected/onError/onReconnect are no-ops |
| Update `src/tests/platform/platformConfigManager.test.ts`                    | `isEmailNotificationEnabled` true/false, `emailNotificationSettings` getter                                          |

---

## Step Order

1. Install `nodemailer` and `@types/nodemailer`
2. Add `EmailNotificationSettings` interface to config types
3. Update schema JSON + config JSON
4. Add `PlatformConfigManager` getters
5. Create `EmailNotificationService`
6. Create `DisconnectNotificationListener`
7. Register listener for both local and MQTT in `ConnectionService`
8. Write unit tests
9. Run `npm run build:local` and `npm test`
