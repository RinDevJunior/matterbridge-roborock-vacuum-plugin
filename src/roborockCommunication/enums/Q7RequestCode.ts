export enum Q7RequestCode {
  query = 10000,
  query_response = 10001,
}

export enum Q7RequestMethod {
  get_status = 'get_status',
  app_start_stop = 'service.set_room_clean',
  app_charge = 'service.start_recharge',
  app_resume = 'app_resume',
  get_room_mapping = 'service.get_preference',
  set_prop = 'prop.set',
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
