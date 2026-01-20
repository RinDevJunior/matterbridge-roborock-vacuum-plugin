import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnsiLogger } from 'matterbridge/logger';
import RoborockService from '@/roborockService.js';
import { RoomIndexMap } from '@/model/RoomIndexMap.js';
import { ClientManager } from '@/services/clientManager.js';

describe('RoborockService - startClean', () => {
  let roborockService: RoborockService;
  let mockLogger: AnsiLogger;
  let clientManager: ClientManager;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      notice: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    } as any;

    clientManager = {} as ClientManager;

    roborockService = new RoborockService(
      undefined, // default auth factory
      undefined, // default IoT factory
      10,
      clientManager,
      mockLogger,
    );
  });

  it('setSelectedAreas should set selected areas', () => {
    roborockService.setSupportedAreaIndexMap(
      'duid',
      new RoomIndexMap(
        new Map([
          [100, { roomId: 1, mapId: 0 }],
          [101, { roomId: 2, mapId: 0 }],
          [102, { roomId: 3, mapId: 0 }],
          [103, { roomId: 4, mapId: 0 }],
          [104, { roomId: 1, mapId: 1 }],
          [105, { roomId: 2, mapId: 1 }],
          [106, { roomId: 3, mapId: 1 }],
          [107, { roomId: 4, mapId: 1 }],
          [108, { roomId: 5, mapId: 1 }],
        ]),
      ),
    );
    roborockService.setSelectedAreas('duid', [106, 108]);

    // Use public API to verify selected areas instead of accessing private state
    expect(roborockService.getSelectedAreas('duid')).toEqual([3, 5]);
    expect(mockLogger.debug).toHaveBeenCalledWith('AreaManagementService - setSelectedAreas - roomIds', [3, 5]);
  });
});
