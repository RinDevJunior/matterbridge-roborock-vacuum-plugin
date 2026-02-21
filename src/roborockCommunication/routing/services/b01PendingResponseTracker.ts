import { AnsiLogger, debugStringify } from 'matterbridge/logger';
import { MESSAGE_TIMEOUT_MS } from '../../../constants/index.js';
import { Q10RequestCode } from '../../enums/Q10RequestCode.js';
import { Dps, HeaderMessage, RequestMessage, ResponseBody, ResponseMessage } from '../../models/index.js';
import { PendingResponseTracker } from './pendingResponseTracker.js';

// Reverse map: numeric string → enum name (e.g. '121' → 'state')
const CODE_NAME_MAP: ReadonlyMap<string, string> = new Map(
  Object.entries(Q10RequestCode)
    .filter(([, v]) => typeof v === 'number')
    .map(([name, value]) => [String(value), name]),
);

const DEFAULT_COLLECTION_WINDOW_MS = 500;
const DEFAULT_TIMESTAMP_TOLERANCE = 1;

interface PendingEntry {
  duid: string;
  expectedTimestamp: number;
  expectedProtocol: number;
  collectedData: Dps;
  lastHeader: HeaderMessage;
  resolve: (response: ResponseMessage) => void;
  reject: (error: Error) => void;
  collectionTimer: NodeJS.Timeout;
  overallTimer: NodeJS.Timeout;
}

export class B01PendingResponseTracker implements PendingResponseTracker {
  private readonly pending: PendingEntry[] = [];

  constructor(
    private readonly logger: AnsiLogger,
    private readonly collectionWindowMs: number = DEFAULT_COLLECTION_WINDOW_MS,
    private readonly timestampTolerance: number = DEFAULT_TIMESTAMP_TOLERANCE,
  ) {}

  public waitFor(request: RequestMessage, duid: string): Promise<ResponseMessage> {
    return new Promise<ResponseMessage>((resolve, reject) => {
      const expectedTimestamp = request.timestamp + 1;
      const expectedProtocol = request.protocol + 1;

      this.logger.debug(
        `[B01PendingResponseTracker] Waiting for responses with timestamp in [${expectedTimestamp}, ${expectedTimestamp + this.timestampTolerance - 1}], protocol: ${expectedProtocol}`,
      );

      const overallTimer = setTimeout(() => {
        this.removeEntry(entry);
        reject(new Error(`[B01PendingResponseTracker] Timeout for request: ${debugStringify(request)}`));
      }, MESSAGE_TIMEOUT_MS);

      const collectionTimer = setTimeout(() => {
        /* no-op until first response arrives */
      }, MESSAGE_TIMEOUT_MS);

      const entry: PendingEntry = {
        duid,
        expectedTimestamp,
        expectedProtocol,
        collectedData: {},
        lastHeader: new HeaderMessage('', 0, 0, 0, 0),
        resolve,
        reject,
        collectionTimer,
        overallTimer,
      };

      this.pending.push(entry);
    });
  }

  public tryResolve(response: ResponseMessage): void {
    if (!response.body) {
      return;
    }

    for (const entry of this.pending) {
      if (!this.matches(response, entry)) {
        continue;
      }

      this.mergeData(entry, response);
      this.resetCollectionWindow(entry);
      return;
    }
  }

  public cancelAll(): void {
    for (const entry of this.pending) {
      clearTimeout(entry.collectionTimer);
      clearTimeout(entry.overallTimer);
      entry.reject(new Error('[B01PendingResponseTracker] Cancelled'));
    }
    this.pending.length = 0;
  }

  private matches(response: ResponseMessage, entry: PendingEntry): boolean {
    const ts = response.header.timestamp;
    const proto = response.header.protocol;

    return (
      ts >= entry.expectedTimestamp &&
      ts < entry.expectedTimestamp + this.timestampTolerance &&
      proto === entry.expectedProtocol
    );
  }

  private mergeData(entry: PendingEntry, response: ResponseMessage): void {
    if (!response.body) {
      return;
    }
    const data = response.body.data;

    // Separate object keys (e.g. '101') from primitive keys (e.g. '121', '122')
    const objectKeys: string[] = [];
    const primitiveKeys: string[] = [];
    for (const key of Object.keys(data)) {
      const value = data[key];
      if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
        objectKeys.push(key);
      } else {
        primitiveKeys.push(key);
      }
    }

    // Merge object keys normally
    for (const key of objectKeys) {
      const existing = entry.collectedData[key];
      const incoming = data[key] as Record<string, unknown>;

      if (existing !== undefined && typeof existing === 'object' && !Buffer.isBuffer(existing)) {
        entry.collectedData[key] = { ...(existing as Record<string, unknown>), ...incoming };
      } else {
        entry.collectedData[key] = incoming;
      }
    }

    // Fold primitive keys into the primary object key (e.g. '101') if one exists
    // Check current response first, then fall back to accumulated data
    const parentKey = objectKeys[0] ?? this.findParentObjectKey(entry);
    if (parentKey && primitiveKeys.length > 0) {
      const parent = entry.collectedData[parentKey] as Record<string, unknown>;
      for (const key of primitiveKeys) {
        parent[key] = data[key];
      }
    } else {
      for (const key of primitiveKeys) {
        entry.collectedData[key] = data[key];
      }
    }

    entry.lastHeader = response.header;

    this.logger.debug(
      `[B01PendingResponseTracker] Collected data chunk, keys: ${Object.keys(entry.collectedData).join(', ')}`,
    );
  }

  private findParentObjectKey(entry: PendingEntry): string | undefined {
    for (const key of Object.keys(entry.collectedData)) {
      const value = entry.collectedData[key];
      if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
        return key;
      }
    }
    return undefined;
  }

  private resetCollectionWindow(entry: PendingEntry): void {
    clearTimeout(entry.collectionTimer);

    entry.collectionTimer = setTimeout(() => {
      this.logger.debug(`[B01PendingResponseTracker] Collection window closed, resolving merged response`);
      clearTimeout(entry.overallTimer);
      this.removeEntry(entry);

      const mappedData = this.mapDataKeys(entry.collectedData);
      const mergedBody = new ResponseBody(mappedData);
      const mergedResponse = new ResponseMessage(entry.duid, entry.lastHeader, mergedBody);
      entry.resolve(mergedResponse);
    }, this.collectionWindowMs);
  }

  private mapDataKeys(data: Dps): Dps {
    const result: Dps = {};
    for (const key of Object.keys(data)) {
      const mappedKey = CODE_NAME_MAP.get(key) ?? key;
      const value = data[key];

      if (typeof value === 'object' && value !== null && !Buffer.isBuffer(value)) {
        const inner: Record<string, unknown> = {};
        for (const innerKey of Object.keys(value)) {
          const mappedInnerKey = CODE_NAME_MAP.get(innerKey) ?? innerKey;
          inner[mappedInnerKey] = (value as Record<string, unknown>)[innerKey];
        }
        result[mappedKey] = inner;
      } else {
        result[mappedKey] = value;
      }
    }
    return result;
  }

  private removeEntry(entry: PendingEntry): void {
    const idx = this.pending.indexOf(entry);
    if (idx >= 0) {
      clearTimeout(entry.collectionTimer);
      clearTimeout(entry.overallTimer);
      this.pending.splice(idx, 1);
    }
  }
}
