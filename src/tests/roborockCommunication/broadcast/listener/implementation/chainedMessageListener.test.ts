import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ChainedMessageListener } from '../../../../../roborockCommunication/routing/listeners/implementation/chainedMessageListener.js';
import { PendingResponseTracker } from '../../../../../roborockCommunication/routing/services/pendingResponseTracker.js';
import { makeLogger, asPartial } from '../../../../testUtils.js';
import { HeaderMessage, ResponseMessage } from '../../../../../roborockCommunication/models/index.js';

describe('ChainedMessageListener', () => {
  let chained: ChainedMessageListener;
  let listener1: { name: string; onMessage: ReturnType<typeof vi.fn<(message: any) => Promise<void>>> };
  let listener2: { name: string; onMessage: ReturnType<typeof vi.fn<(message: any) => Promise<void>>> };
  const message = asPartial<ResponseMessage>({ duid: 'test-duid', header: asPartial<HeaderMessage>({}), get: () => undefined });

  const logger = makeLogger();
  const responseTracker = new PendingResponseTracker(logger);

  beforeEach(() => {
    chained = new ChainedMessageListener(responseTracker, logger);
    listener1 = { name: 'listener1', onMessage: vi.fn<(message: any) => Promise<void>>() };
    listener2 = { name: 'listener2', onMessage: vi.fn<(message: any) => Promise<void>>() };
  });

  it('should call onMessage on all registered listeners', async () => {
    chained.register(listener1);
    chained.register(listener2);

    await chained.onMessage(message);

    expect(listener1.onMessage).toHaveBeenCalledWith(message);
    expect(listener2.onMessage).toHaveBeenCalledWith(message);
  });

  it('should not fail if no listeners registered', () => {
    expect(() => chained.onMessage(message)).not.toThrow();
  });

  it('should call listeners in order', async () => {
    const callOrder: string[] = [];
    listener1.onMessage.mockImplementation(async () => {
      callOrder.push('first');
    });
    listener2.onMessage.mockImplementation(async () => {
      callOrder.push('second');
    });

    chained.register(listener1);
    chained.register(listener2);

    await chained.onMessage(message);

    expect(callOrder).toEqual(['first', 'second']);
  });
});
