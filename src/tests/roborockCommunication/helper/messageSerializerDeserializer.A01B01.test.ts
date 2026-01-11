import { MessageSerializer } from '../../../roborockCommunication/helper/messageSerializer';
import { MessageDeserializer } from '../../../roborockCommunication/helper/messageDeserializer';
import { MessageContext } from '../../../roborockCommunication/broadcast/model/messageContext';
import { RequestMessage } from '../../../roborockCommunication/broadcast/model/requestMessage';
import { Protocol } from '../../../roborockCommunication/broadcast/model/protocol';

const logger: any = { debug: jest.fn(), notice: jest.fn(), error: jest.fn() };

describe('MessageSerializer/Deserializer A01 & B01', () => {
  test('A01 roundtrip rpc_response', () => {
    const userdata: any = { rriot: { k: 'somek' } };
    const ctx = new MessageContext(userdata);
    const duid = 'd-a01';
    const localKey = '0123456789abcdef';
    ctx.registerDevice(duid, localKey, 'A01', 12345);

    const serializer = new MessageSerializer(ctx, logger);
    const deserializer = new MessageDeserializer(ctx, logger);

    const req = new RequestMessage({
      messageId: 7,
      protocol: Protocol.rpc_response,
      // for A01 builder provide dps directly
      dps: { [Protocol.rpc_response]: JSON.stringify({ id: 7, result: null }) },
      nonce: 12345,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const res = serializer.serialize(duid, req);
    expect(res).toHaveProperty('buffer');

    const out = deserializer.deserialize(duid, res.buffer);
    // ensure rpc_response dps exists and has an id
    const got: any = out.get(Protocol.rpc_response);
    expect(got).toBeDefined();
    expect(got.id).toBeDefined();
  });

  test('B01 roundtrip rpc_response', () => {
    const userdata: any = { rriot: { k: 'otherk' } };
    const ctx = new MessageContext(userdata);
    const duid = 'd-b01';
    const localKey = 'fedcba9876543210';
    ctx.registerDevice(duid, localKey, 'B01', 22222);

    const serializer = new MessageSerializer(ctx, logger);
    const deserializer = new MessageDeserializer(ctx, logger);

    const req = new RequestMessage({
      messageId: 9,
      protocol: Protocol.rpc_response,
      // for B01 builder provide dps directly
      dps: { [Protocol.rpc_response]: JSON.stringify({ id: 9, result: null }) },
      nonce: 22222,
      timestamp: Math.floor(Date.now() / 1000),
    });
    const res = serializer.serialize(duid, req);
    expect(res).toHaveProperty('buffer');

    const out = deserializer.deserialize(duid, res.buffer);
    // ensure rpc_response dps exists and has an id
    const got: any = out.get(Protocol.rpc_response);
    expect(got).toBeDefined();
    expect(got.id).toBeDefined();
  });
});
