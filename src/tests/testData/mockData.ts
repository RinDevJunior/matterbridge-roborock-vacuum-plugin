import { ServiceArea } from 'matterbridge/matter/clusters';
import { Home, MapInfo } from '../../roborockCommunication/index.js';
import { CloudMessageResult } from '../../roborockCommunication/Zmodel/messageResult.js';

export const supportedAreas: ServiceArea.Area[] = [
  { areaId: 100, mapId: 0, areaInfo: { locationInfo: { locationName: 'Kitchen', floorNumber: 0, areaType: null }, landmarkInfo: null } },
  { areaId: 101, mapId: 0, areaInfo: { locationInfo: { locationName: 'Study', floorNumber: 0, areaType: null }, landmarkInfo: null } },
  { areaId: 102, mapId: 0, areaInfo: { locationInfo: { locationName: 'Living room', floorNumber: 0, areaType: null }, landmarkInfo: null } },
  { areaId: 103, mapId: 0, areaInfo: { locationInfo: { locationName: 'Bedroom', floorNumber: 0, areaType: null }, landmarkInfo: null } },
  { areaId: 104, mapId: 1, areaInfo: { locationInfo: { locationName: 'Living room', floorNumber: 1, areaType: null }, landmarkInfo: null } },
  { areaId: 105, mapId: 1, areaInfo: { locationInfo: { locationName: 'Guest bedroom', floorNumber: 1, areaType: null }, landmarkInfo: null } },
  { areaId: 106, mapId: 1, areaInfo: { locationInfo: { locationName: 'Master bedroom', floorNumber: 1, areaType: null }, landmarkInfo: null } },
  { areaId: 107, mapId: 1, areaInfo: { locationInfo: { locationName: 'Balcony', floorNumber: 1, areaType: null }, landmarkInfo: null } },
];

export const supportedMaps: ServiceArea.Map[] = [
  { mapId: 0, name: 'First Map' },
  { mapId: 1, name: 'Second Map' },
];

export const roomIndexMap = {
  indexMap: new Map([
    [100, { roomId: 1, mapId: 0 }],
    [101, { roomId: 2, mapId: 0 }],
    [102, { roomId: 3, mapId: 0 }],
    [103, { roomId: 4, mapId: 0 }],
    [104, { roomId: 1, mapId: 1 }],
    [105, { roomId: 2, mapId: 1 }],
    [106, { roomId: 3, mapId: 1 }],
    [107, { roomId: 4, mapId: 1 }],
  ]),
  roomMap: new Map([
    [1, 104],
    [2, 105],
    [3, 106],
    [4, 107],
  ]),
};

export const mapInfo = new MapInfo({
  max_multi_map: 1,
  max_bak_map: 1,
  multi_map_count: 1,
  map_info: [
    {
      mapFlag: 0,
      add_time: 1753511673,
      length: 9,
      name: 'First Map',
      bak_maps: [{ mapFlag: 4, add_time: 1753578164 }],
      rooms: [
        { id: 1, tag: 14, iot_name_id: '11100845', iot_name: 'Kitchen' },
        { id: 2, tag: 9, iot_name_id: '11100849', iot_name: 'Study' },
        {
          id: 3,
          tag: 6,
          iot_name_id: '11100842',
          iot_name: 'Living room',
        },
        { id: 4, tag: 1, iot_name_id: '11100847', iot_name: 'Bedroom' },
      ],
    },
    {
      mapFlag: 1,
      add_time: 1753579596,
      length: 10,
      name: 'Second Map',
      bak_maps: [{ mapFlag: 5, add_time: 1753578579 }],
      rooms: [
        {
          id: 1,
          tag: 6,
          iot_name_id: '11100842',
          iot_name: 'Living room',
        },
        {
          id: 2,
          tag: 3,
          iot_name_id: '12461114',
          iot_name: 'Guest bedroom',
        },
        {
          id: 3,
          tag: 2,
          iot_name_id: '12461109',
          iot_name: 'Master bedroom',
        },
        { id: 4, tag: 7, iot_name_id: '12461111', iot_name: 'Balcony' },
      ],
    },
  ],
});

export const roomData = [
  [1, '11100845', 14],
  [2, '11100849', 9],
  [3, '11100842', 6],
  [4, '11100847', 1],
];

export const cloudMessageResult1: CloudMessageResult = {
  msg_ver: 2,
  msg_seq: 424,
  state: 5,
  battery: 100,
  clean_time: 2823,
  clean_area: 36002500,
  error_code: 0,
  map_present: 1,
  in_cleaning: 0,
  in_returning: 0,
  in_fresh_state: 1,
  lab_status: 3,
  water_box_status: 1,
  back_type: -1,
  wash_phase: 0,
  wash_ready: 1,
  wash_status: 0,
  fan_power: 110,
  dnd_enabled: 0,
  map_status: 3,
  is_locating: 0,
  lock_status: 0,
  water_box_mode: 209,
  distance_off: 155,
  water_box_carriage_status: 1,
  mop_forbidden_enable: 1,
  camera_status: 1,
  is_exploring: 0,
  adbumper_status: [0, 0, 0],
  water_shortage_status: 0,
  dock_type: 14,
  dust_collection_status: 0,
  auto_dust_collection: 1,
  avoid_count: 209,
  mop_mode: 306,
  debug_mode: 0,
  in_warmup: 0,
  collision_avoid_status: 1,
  switch_map_mode: 1,
  dock_error_status: 0,
  charge_status: 1,
  unsave_map_reason: 0,
  unsave_map_flag: -1,
  dry_status: 0,
  rdt: 0,
  clean_percent: 0,
  extra_time: 860,
  rss: 2,
  dss: 168,
  common_status: 2,
  last_clean_t: 1754063701,
  replenish_mode: 0,
  repeat: 1,
  kct: 0,
  subdivision_sets: 0,
  cleaning_info: { target_segment_id: -1, segment_id: 3, fan_power: 102, water_box_status: 202, mop_mode: 306 },
  exit_dock: 0,
  seq_type: 0,
};

export const cloudMessageResult2: CloudMessageResult = {
  msg_ver: 2,
  msg_seq: 424,
  state: 5,
  battery: 100,
  clean_time: 2823,
  clean_area: 36002500,
  error_code: 0,
  map_present: 1,
  in_cleaning: 0,
  in_returning: 0,
  in_fresh_state: 1,
  lab_status: 3,
  water_box_status: 1,
  back_type: -1,
  wash_phase: 0,
  wash_ready: 1,
  wash_status: 0,
  fan_power: 110,
  dnd_enabled: 0,
  map_status: 3,
  is_locating: 0,
  lock_status: 0,
  water_box_mode: 209,
  distance_off: 155,
  water_box_carriage_status: 1,
  mop_forbidden_enable: 1,
  camera_status: 1,
  is_exploring: 0,
  adbumper_status: [0, 0, 0],
  water_shortage_status: 0,
  dock_type: 14,
  dust_collection_status: 0,
  auto_dust_collection: 1,
  avoid_count: 209,
  mop_mode: 306,
  debug_mode: 0,
  in_warmup: 0,
  collision_avoid_status: 1,
  switch_map_mode: 1,
  dock_error_status: 0,
  charge_status: 1,
  unsave_map_reason: 0,
  unsave_map_flag: -1,
  dry_status: 0,
  rdt: 0,
  clean_percent: 0,
  extra_time: 860,
  rss: 2,
  dss: 168,
  common_status: 2,
  last_clean_t: 1754063701,
  replenish_mode: 0,
  repeat: 1,
  kct: 0,
  subdivision_sets: 0,
  cleaning_info: { target_segment_id: 4, segment_id: -1, fan_power: 102, water_box_status: 202, mop_mode: 306 },
  exit_dock: 0,
  seq_type: 0,
};

export const cloudMessageResult3: CloudMessageResult = {
  msg_ver: 2,
  msg_seq: 1579,
  state: 5,
  battery: 94,
  clean_time: 567,
  clean_area: 36002500,
  error_code: 0,
  map_present: 1,
  in_cleaning: 0,
  in_returning: 0,
  in_fresh_state: 1,
  lab_status: 3,
  water_box_status: 1,
  fan_power: 104,
  dnd_enabled: 0,
  map_status: 3,
  is_locating: 0,
  lock_status: 0,
  water_box_mode: 202,
  distance_off: 60,
  water_box_carriage_status: 0,
  mop_forbidden_enable: 0,
  adbumper_status: [0, 0, 0],
  dock_type: 5,
  dust_collection_status: 0,
  auto_dust_collection: 1,
  debug_mode: 0,
  switch_map_mode: 0,
  dock_error_status: 0,
  charge_status: 1,
};

export const homeData: Home = {
  id: 3645093,
  name: 'My Home',
  products: [
    {
      id: '2CjvhDFL7Q9NdJQmhE86zn',
      name: 'Roborock Qrevo Edge Series',
      model: 'test-model',
      category: 'robot.vacuum.cleaner',
      schema: [
        { id: 101, name: 'rpc_request', code: 'rpc_request', mode: 'rw', type: 'RAW', property: null },
        { id: 102, name: 'rpc_response', code: 'rpc_response', mode: 'rw', type: 'RAW', property: null },
        { id: 120, name: '错误代码', code: 'error_code', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 121, name: '设备状态', code: 'state', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 122, name: '设备电量', code: 'battery', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 123, name: '清扫模式', code: 'fan_power', mode: 'rw', type: 'ENUM', property: '{"range": [""]}' },
        { id: 124, name: '拖地模式', code: 'water_box_mode', mode: 'rw', type: 'ENUM', property: '{"range": [""]}' },
        { id: 125, name: '主刷寿命', code: 'main_brush_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 126, name: '边刷寿命', code: 'side_brush_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 127, name: '滤网寿命', code: 'filter_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 128, name: '额外状态', code: 'additional_props', mode: 'ro', type: 'RAW', property: null },
        { id: 130, name: '完成事件', code: 'task_complete', mode: 'ro', type: 'RAW', property: null },
        { id: 131, name: '电量不足任务取消', code: 'task_cancel_low_power', mode: 'ro', type: 'RAW', property: null },
        { id: 132, name: '运动中任务取消', code: 'task_cancel_in_motion', mode: 'ro', type: 'RAW', property: null },
        { id: 133, name: '充电状态', code: 'charge_status', mode: 'ro', type: 'RAW', property: null },
        { id: 134, name: '烘干状态', code: 'drying_status', mode: 'ro', type: 'RAW', property: null },
        { id: 135, name: '离线原因细分', code: 'offline_status', mode: 'ro', type: 'RAW', property: null },
        { id: 139, name: '回基站目的', code: 'back_type', mode: 'ro', type: 'RAW', property: null },
      ],
    },
  ],
  devices: [
    {
      duid: 'test-duid',
      name: 'Roborock Qrevo Edge 5V1',
      activeTime: 1749443275,
      createTime: 1746940587,
      localKey: 'v0OKpWXwBmiCk4ku',
      productId: '2CjvhDFL7Q9NdJQmhE86zn',
      online: true,
      fv: '02.28.34',
      pv: '1.0',
      sn: 'RCIEBS50900224',
      featureSet: '2247397454282751',
      newFeatureSet: '00040040282834C9C2FA8F5C7EDEFFFE',
      deviceStatus: { 120: 0, 121: 8, 122: 100, 123: 110, 124: 209, 125: 93, 126: 69, 127: 86, 128: 0, 133: 1, 134: 0, 135: 0, 139: 0 },
      silentOtaSwitch: true,
      rrHomeId: 3645093,
      rooms: [
        { id: 11100849, name: 'Study' },
        { id: 11100847, name: 'Bedroom' },
        { id: 11100845, name: 'Kitchen' },
        { id: 11100842, name: 'Living room' },
      ],
      serialNumber: 'RCIEBS50900224',
      data: {
        id: 'test-duid',
        firmwareVersion: '02.28.34',
        serialNumber: 'RCIEBS50900224',
        model: 'test-model',
        category: 'robot.vacuum.cleaner',
        batteryLevel: 100,
      },
      store: {
        userData: {
          uid: 3635748,
          tokentype: '',
          token: 'rr65af7107da5840:txP8ZF7dj8v7xUMkoFMzZA==:01981b12f83a7723a1cbef8c8e89a7e1',
          rruid: 'rr65af7107da5840',
          region: 'us',
          countrycode: '84',
          country: 'VN',
          nickname: 'Ryan',
          rriot: {
            u: '6BtaRwE14spvanEazqX0kQ',
            s: 'OsErWk',
            h: '195Xn4u3fe',
            k: 'ofKw7nJc',
            r: { r: 'US', a: 'https://api-us.roborock.com', m: 'ssl://mqtt-us-2.roborock.com:8883', l: 'https://wood-us.roborock.com' },
          },
        },
        localKey: 'v0OKpWXwBmiCk4ku',
        pv: '1.0',
        model: 'test-model',
      },
      schema: [
        { id: 101, name: 'rpc_request', code: 'rpc_request', mode: 'rw', type: 'RAW', property: null },
        { id: 102, name: 'rpc_response', code: 'rpc_response', mode: 'rw', type: 'RAW', property: null },
        { id: 120, name: '错误代码', code: 'error_code', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 121, name: '设备状态', code: 'state', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 122, name: '设备电量', code: 'battery', mode: 'ro', type: 'ENUM', property: '{"range": [""]}' },
        { id: 123, name: '清扫模式', code: 'fan_power', mode: 'rw', type: 'ENUM', property: '{"range": [""]}' },
        { id: 124, name: '拖地模式', code: 'water_box_mode', mode: 'rw', type: 'ENUM', property: '{"range": [""]}' },
        { id: 125, name: '主刷寿命', code: 'main_brush_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 126, name: '边刷寿命', code: 'side_brush_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 127, name: '滤网寿命', code: 'filter_life', mode: 'rw', type: 'VALUE', property: '{"max": 100, "min": 0, "step": 1, "unit": "null", "scale": 1}' },
        { id: 128, name: '额外状态', code: 'additional_props', mode: 'ro', type: 'RAW', property: null },
        { id: 130, name: '完成事件', code: 'task_complete', mode: 'ro', type: 'RAW', property: null },
        { id: 131, name: '电量不足任务取消', code: 'task_cancel_low_power', mode: 'ro', type: 'RAW', property: null },
        { id: 132, name: '运动中任务取消', code: 'task_cancel_in_motion', mode: 'ro', type: 'RAW', property: null },
        { id: 133, name: '充电状态', code: 'charge_status', mode: 'ro', type: 'RAW', property: null },
        { id: 134, name: '烘干状态', code: 'drying_status', mode: 'ro', type: 'RAW', property: null },
        { id: 135, name: '离线原因细分', code: 'offline_status', mode: 'ro', type: 'RAW', property: null },
        { id: 139, name: '回基站目的', code: 'back_type', mode: 'ro', type: 'RAW', property: null },
      ],
    },
  ],
  receivedDevices: [],
  rooms: [
    { id: 11100849, name: 'Study' },
    { id: 11100847, name: 'Bedroom' },
    { id: 11100845, name: 'Kitchen' },
    { id: 11100842, name: 'Living room' },
  ],
};
