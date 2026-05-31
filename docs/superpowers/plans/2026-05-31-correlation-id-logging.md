# Correlation ID Logging Implementation Plan

**Goal:** Add correlation IDs to all logs so related log lines from the same pipeline execution can be grouped and filtered in Grafana.

**Architecture:** Use Node.js `AsyncLocalStorage` to propagate a correlation ID transparently through async call chains — no parameter drilling needed. A correlation ID is generated at each pipeline entry point (user command, polling tick, inbound MQTT update) and automatically attached as a `correlation_id` attribute to every OTel log record emitted within that execution context.

**Tech Stack:** Node.js `async_hooks.AsyncLocalStorage`, `crypto.randomBytes`, existing `@opentelemetry/api-logs` attribute map.

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/share/correlationContext.ts` | AsyncLocalStorage wrapper: `runWithCorrelation`, `getCorrelationId`, `generateCorrelationId` |
| Modify | `src/share/otelLogger.ts` | Read `getCorrelationId()` and add `correlation_id` attribute when present |
| Modify | `src/types/roborockVacuumCleaner.ts` | Wrap each command handler body with `runWithCorrelation` |
| Modify | `src/services/pollingService.ts` | Wrap `setInterval` callback with `runWithCorrelation` |
| Modify | `src/platformRunner.ts` | Wrap `updateRobotWithPayload` body with `runWithCorrelation` |

---

## Task 1: CorrelationContext Module

**Files:**
- Create: `src/share/correlationContext.ts`

- [ ] **Implement the module**

```typescript
// src/share/correlationContext.ts
import { AsyncLocalStorage } from 'async_hooks';
import { randomBytes } from 'crypto';

const storage = new AsyncLocalStorage<string>();

export function runWithCorrelation<T>(id: string, fn: () => T): T {
  return storage.run(id, fn);
}

export function getCorrelationId(): string | undefined {
  return storage.getStore();
}

export function generateCorrelationId(prefix: string): string {
  return `${prefix}:${randomBytes(4).toString('hex')}`;
}
```

---

## Task 2: OtelLogger Emits Correlation ID

**Files:**
- Modify: `src/share/otelLogger.ts:32-41`

- [ ] **Add import and update `emitToOtel`**

```typescript
// add to imports:
import { getCorrelationId } from './correlationContext.js';

// replace emitToOtel method:
private emitToOtel(level: LogLevel, message: string, parameters: unknown[]): void {
  const sanitizedMessage = this.sanitizeSensitiveLogs ? String(this.filterSensitive(message)) : message;
  const sanitizedParams = parameters.map((p) =>
    this.sanitizeSensitiveLogs ? String(this.filterSensitive(p)) : String(p),
  );

  const body =
    sanitizedParams.length > 0 ? `${sanitizedMessage} ${sanitizedParams.join(' ')}` : sanitizedMessage;

  const attributes: Record<string, string> = {
    'plugin.name': PLUGIN_NAME,
    'plugin.version': PLUGIN_VERSION,
  };

  const correlationId = getCorrelationId();
  if (correlationId !== undefined) {
    attributes['correlation_id'] = correlationId;
  }

  this.bridge.logger.emit({
    severityNumber: toSeverityNumber(level),
    severityText: String(level),
    body,
    timestamp: new Date(),
    attributes,
  });
}
```

---

## Task 3: Command Handler Correlation (roborockVacuumCleaner)

**Files:**
- Modify: `src/types/roborockVacuumCleaner.ts:95-131`

- [ ] **Add import and wrap each command handler in `configureHandler`**

```typescript
// add to imports:
import { generateCorrelationId, runWithCorrelation } from '../share/correlationContext.js';
```

Replace the command registrations (lines ~95–131), keeping `IDENTIFY` unchanged:

```typescript
this.addCommandHandlerWithErrorHandling(CommandNames.SELECT_AREAS, ({ request }) =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    const { newAreas } = request as ServiceArea.SelectAreasRequest;
    if (!newAreas || newAreas.length === 0) {
      this.log.info(
        'selectAreas called with empty or undefined areas, it means selecting no areas or all areas, ignoring.',
      );
      return;
    }
    this.log.info(`Selecting areas: ${newAreas.join(', ')}`);
    behaviorHandler.executeCommand(CommandNames.SELECT_AREAS, newAreas);
  }),
);

this.addCommandHandlerWithErrorHandling(CommandNames.CHANGE_TO_MODE, ({ request }) =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    const { newMode } = request as ModeBase.ChangeToModeRequest;
    this.log.info(`Changing to mode: ${newMode}`);
    behaviorHandler.executeCommand(CommandNames.CHANGE_TO_MODE, newMode);
  }),
);

this.addCommandHandlerWithErrorHandling(CommandNames.PAUSE, () =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    this.log.info('Pause command received');
    behaviorHandler.executeCommand(CommandNames.PAUSE);
  }),
);

this.addCommandHandlerWithErrorHandling(CommandNames.RESUME, () =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    this.log.info('Resume command received');
    behaviorHandler.executeCommand(CommandNames.RESUME);
  }),
);

this.addCommandHandlerWithErrorHandling(CommandNames.GO_HOME, () =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    this.log.info('GoHome command received');
    behaviorHandler.executeCommand(CommandNames.GO_HOME);
  }),
);

this.addCommandHandlerWithErrorHandling(CommandNames.STOP, () =>
  runWithCorrelation(generateCorrelationId('cmd'), async () => {
    this.log.info('Stop command received');
    behaviorHandler.executeCommand(CommandNames.STOP);
  }),
);
```

---

## Task 4: Polling Service Correlation

**Files:**
- Modify: `src/services/pollingService.ts:23-35`

- [ ] **Add import and wrap the `setInterval` callback**

```typescript
// add to imports:
import { generateCorrelationId, runWithCorrelation } from '../share/correlationContext.js';
```

Replace the `setInterval` block in `activateDeviceNotifyOverLocal`:

```typescript
const interval = setInterval(() => {
  void runWithCorrelation(generateCorrelationId('poll'), async () => {
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
  });
}, this.refreshInterval * LOCAL_REFRESH_INTERVAL_MULTIPLIER);
```

---

## Task 5: Inbound Update Correlation (PlatformRunner)

**Files:**
- Modify: `src/platformRunner.ts:85-107`

- [ ] **Add import and wrap `updateRobotWithPayload` body**

```typescript
// add to imports:
import { generateCorrelationId, runWithCorrelation } from './share/correlationContext.js';
```

Update `updateRobotWithPayload`:

```typescript
public async updateRobotWithPayload(payload: MessagePayload): Promise<void> {
  if (!this.activateHandlers) return;

  await runWithCorrelation(generateCorrelationId('upd'), async () => {
    const { type } = payload;
    switch (type) {
      case NotifyMessageTypes.ErrorOccurred:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleErrorOccurred.bind(this));
        break;
      case NotifyMessageTypes.BatteryUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleBatteryUpdate.bind(this));
        break;
      case NotifyMessageTypes.DeviceStatus:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleDeviceStatusUpdate.bind(this));
        break;
      case NotifyMessageTypes.DeviceStatusSimple:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleDeviceStatusSimpleUpdate.bind(this));
        break;
      case NotifyMessageTypes.CleanModeUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleCleanModeUpdate.bind(this));
        break;
      case NotifyMessageTypes.ServiceAreaUpdate:
        await this.executeWithRobot(payload.data.duid, payload.data, this.handleServiceAreaUpdate.bind(this));
        break;
      // keep all remaining cases from the original switch unchanged
    }
  });
}
```

> Copy ALL existing `case` branches from the original — do not drop any.

---

## Grafana Queries

Query logs grouped by pipeline:
```logql
{service_name="roborock-vacuum-plugin"} | json | line_format "{{.correlation_id}} {{.body}}"
```

Filter a single pipeline run:
```logql
{service_name="roborock-vacuum-plugin"} | json | correlation_id="cmd:a3f2b1c4"
```

Show only command pipelines:
```logql
{service_name="roborock-vacuum-plugin"} | json | correlation_id =~ "cmd:.*"
```
