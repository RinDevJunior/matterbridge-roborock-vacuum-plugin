import { CleanModeSetting } from '../../../behaviors/roborock.vacuum/core/CleanModeSetting.js';
import { MapInfo } from '../../../core/application/models/index.js';
import { MapRoomResponse } from '../../../types/index.js';
import { DeviceStatus, NetworkInfo, RawRoomMappingData, RequestMessage } from '../../models/index.js';

export interface AbstractMessageDispatcher {
  dispatcherName: string;

  getNetworkInfo(duid: string): Promise<NetworkInfo | undefined>;
  getDeviceStatus(duid: string): Promise<DeviceStatus | undefined>;
  goHome(duid: string): Promise<void>;
  startCleaning(duid: string): Promise<void>;
  startRoomCleaning(duid: string, roomIds: number[], repeat: number): Promise<void>;
  pauseCleaning(duid: string): Promise<void>;
  resumeCleaning(duid: string): Promise<void>;
  resumeRoomCleaning(duid: string): Promise<void>;
  stopCleaning(duid: string): Promise<void>;
  findMyRobot(duid: string): Promise<void>;

  // For custom messages
  sendCustomMessage(duid: string, def: RequestMessage): Promise<void>;
  getCustomMessage<T = unknown>(duid: string, def: RequestMessage): Promise<T>;

  getCleanModeData(duid: string): Promise<CleanModeSetting>;
  changeCleanMode(duid: string, suctionPower: number, waterFlow: number, mopRoute: number, distance_off: number): Promise<void>;

  // For core data retrieval
  getHomeMap(duid: string): Promise<MapRoomResponse>;
  getMapInfo(duid: string): Promise<MapInfo>;
  getRoomMap(duid: string, activeMap: number): Promise<RawRoomMappingData>;
}
