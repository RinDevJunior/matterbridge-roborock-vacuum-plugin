# Claude History

## 2026-02-15
- Created B01 map parser for extracting rooms from protobuf-encoded map data.
- Added `protobufjs` dependency.
- Created files: `src/roborockCommunication/map/b01/b01MapParser.ts`, `types.ts`, `roborockProto.ts`.
- Proto schema minimized to only room-related messages (`RobotMap`, `RoomDataInfo`, `DevicePointInfo`, `MapHeadInfo`).
