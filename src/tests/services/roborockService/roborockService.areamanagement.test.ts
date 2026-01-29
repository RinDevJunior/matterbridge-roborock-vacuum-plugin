import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoborockService } from '../../../services/roborockService.js';
import { RoomIndexMap } from '../../../core/application/models/index.js';

describe('RoborockService - Area Management', () => {
  let roborockService: RoborockService;
  let mockLogger: any;

  beforeEach(() => {
    mockLogger = { debug: vi.fn(), error: vi.fn(), warn: vi.fn() };

    roborockService = new RoborockService(
      {
        authenticateApiFactory: () => undefined as any,
        iotApiFactory: () => undefined as any,
        refreshInterval: 10,
        baseUrl: 'https://api.roborock.com',
        persist: {} as any,
        configManager: {} as any,
      },
      mockLogger,
      {} as any,
    );

    roborockService.setSupportedAreaIndexMap(
      'duid-123',
      new RoomIndexMap(
        new Map([
          [1, { roomId: 1, mapId: 1 }],
          [2, { roomId: 2, mapId: 2 }],
        ]),
      ),
    );
  });

  it('should set selected areas', () => {
    roborockService.setSelectedAreas('duid-123', [1, 2]);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([1, 2]);
  });

  it('should clear selected areas', () => {
    roborockService.setSelectedAreas('duid-123', []);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([]);
  });

  it('should filter out invalid areas', () => {
    roborockService.setSelectedAreas('duid-123', [7, 8]);
    expect(roborockService.getSelectedAreas('duid-123')).toEqual([]);
  });
});
