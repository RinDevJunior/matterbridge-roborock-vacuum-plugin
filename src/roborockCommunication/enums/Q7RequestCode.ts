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
}
