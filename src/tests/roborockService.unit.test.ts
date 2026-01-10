import RoborockService from '../roborockService';
import { RoomIndexMap } from '../model/roomIndexMap';

const logger: any = { debug: jest.fn(), error: jest.fn(), notice: jest.fn(), warn: jest.fn() };

describe('RoborockService basic behaviors', () => {
  it('maps selected area ids to room ids via RoomIndexMap in setSelectedAreas', () => {
    const fakeAuth = jest.fn();
    const fakeIotFactory = jest.fn().mockReturnValue({});
    const clientManager: any = {};

    const svc = new RoborockService(fakeAuth as any, fakeIotFactory as any, 1, clientManager as any, logger as any);

    const map = new Map<number, any>();
    map.set(5, { roomId: 42, mapId: 1 });
    const rim = new RoomIndexMap(map);

    svc.setSupportedAreaIndexMap('d1', rim);
    svc.setSelectedAreas('d1', [5]);

    const sel = svc.getSelectedAreas('d1');
    expect(sel).toEqual([42]);
  });

  it('getCleanModeData throws when message processor not available', async () => {
    const fakeAuth = jest.fn();
    const fakeIotFactory = jest.fn().mockReturnValue({});
    const clientManager: any = {};

    const svc = new RoborockService(fakeAuth as any, fakeIotFactory as any, 1, clientManager as any, logger as any);

    await expect(svc.getCleanModeData('nope')).rejects.toThrow('Failed to retrieve clean mode data');
  });

  it('getRoomIdFromMap returns vacuumRoom from customGet', async () => {
    const fakeAuth = jest.fn();
    const fakeIotFactory = jest.fn().mockReturnValue({});
    const clientManager: any = {};

    const svc: any = new RoborockService(fakeAuth as any, fakeIotFactory as any, 1, clientManager as any, logger as any);
    svc.customGet = jest.fn().mockResolvedValue({ vacuumRoom: 11 });

    const room = await svc.getRoomIdFromMap('d1');
    expect(room).toBe(11);
  });

  it('getCustomAPI returns error object when iotApi.getCustom throws', async () => {
    const fakeAuth = jest.fn();
    const fakeIotFactory = jest.fn().mockReturnValue({ getCustom: jest.fn().mockRejectedValue(new Error('boom')) });
    const clientManager: any = {};

    const svc: any = new RoborockService(fakeAuth as any, fakeIotFactory as any, 1, clientManager as any, logger as any);
    // initialize internal iotApi via private auth
    svc['auth']({});

    const res = await svc.getCustomAPI('http://x');
    expect(res).toHaveProperty('error');
    expect(res).toHaveProperty('result');
  });
});
