export enum Q10RequestCode {
  clean_time = 6,
  clean_area = 7,

  multimap = 61,
  networkinfo = 81,

  rpc_request = 101,
  rpc_response = 102,
  heart_beat = 110,
  status = 121,

  get_prop = 999, // TODO: Verify

  clean_task_type = 138,

  app_start = 201,
  app_charge = 203,
  app_pause = 204,
  app_resume = 205,
  app_stop = 206,
  ceip = 207,
}

export enum Q10RequestMethod {
  multimap = 61,
  change_vacuum_mode = 123,
  change_mop_mode = 124,
  change_clean_mode = 137,
}
