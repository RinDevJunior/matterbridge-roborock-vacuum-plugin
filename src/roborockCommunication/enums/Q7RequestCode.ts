export enum Q7RequestCode {
  query = 10000,
  query_response = 10001,
}

export enum Q7RequestMethod {
  get_status = 'get_status',
  app_start_stop = 'service.set_room_clean',
  app_charge = 'service.start_recharge',
  app_resume = 'app_resume',
  get_room_mapping_backup_1 = 'service.get_preference',
  get_room_mapping = 'service.upload_by_maptype',
  set_prop = 'prop.set',
  get_prop = 'prop.get',
  get_map_list = 'service.get_map_list',
  find_me = 'service.find_device',
}

export enum Q7ControlCode {
  start = 1,
  pause = 2,
  stop = 0,
}

export enum Q7CleanType {
  full_clean = 0,
  room_clean = 1,
  area_clean = 4,
  room_normal_clean = 5,
  custom_clean = 6,
  all_custom_clean = 11,
  area_custom_clean = 99,
}

export enum Q7PropRequestCode {
  status = 'status',
  mode = 'mode',
  wind = 'wind',
  water = 'water',
  sweep_type = 'sweep_type',
  clean_path_preference = 'clean_path_preference',
  quantity = 'quantity',
  cleaning_time = 'cleaning_time',
  cleaning_area = 'cleaning_area',
  clean_finish = 'clean_finish',
  fault = 'fault',
}
