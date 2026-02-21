export const ROBOROCK_PROTO_STR = `syntax = "proto3";

package SCMap;

message RobotMap {
    uint32 mapType = 1;
    MapHeadInfo mapHead = 3;
    repeated RoomDataInfo roomDataInfo = 12;
}

message MapHeadInfo {
    uint32 mapHeadId = 1;
    uint32 sizeX = 2;
    uint32 sizeY = 3;
    float minX = 4;
    float minY = 5;
    float maxX = 6;
    float maxY = 7;
    float resolution = 8;
}

message RoomDataInfo {
    uint32 roomId = 1;
    string roomName = 2;
    uint32 roomTypeId = 3;
    uint32 colorId = 10;
    DevicePointInfo roomNamePost = 8;
}

message DevicePointInfo {
    float x = 1;
    float y = 2;
}
`;
