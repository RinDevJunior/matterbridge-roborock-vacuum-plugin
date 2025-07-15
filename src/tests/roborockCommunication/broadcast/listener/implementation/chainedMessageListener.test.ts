import { ChainedMessageListener } from '../../../../../roborockCommunication/broadcast/listener/implementation/chainedMessageListener';
import { AbstractMessageListener } from '../../../../../roborockCommunication/broadcast/listener/abstractMessageListener';

describe('ChainedMessageListener', () => {
  let chained: ChainedMessageListener;
  let listener1: jest.Mocked<AbstractMessageListener>;
  let listener2: jest.Mocked<AbstractMessageListener>;
  const message = { foo: 'bar' } as any;

  beforeEach(() => {
    chained = new ChainedMessageListener();
    listener1 = { onMessage: jest.fn().mockResolvedValue(undefined) } as any;
    listener2 = { onMessage: jest.fn().mockResolvedValue(undefined) } as any;
  });

  it('should call onMessage on all registered listeners', async () => {
    chained.register(listener1);
    chained.register(listener2);

    await chained.onMessage(message);

    expect(listener1.onMessage).toHaveBeenCalledWith(message);
    expect(listener2.onMessage).toHaveBeenCalledWith(message);
  });

  it('should not fail if no listeners registered', async () => {
    await expect(chained.onMessage(message)).resolves.toBeUndefined();
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
