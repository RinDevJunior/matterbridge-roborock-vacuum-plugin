export enum Protocol {
  hello_request = 0,
  hello_response = 1,
  ping_request = 2,
  ping_response = 3,
  general_request = 4,
  general_response = 5,
  rpc_request = 101,
  rpc_response = 102,
  error = 120,
  status_update = 121,
  battery = 122,
  suction_power = 123,
  water_box_mode = 124,
  additional_props = 128,
  todo_some_thing_need_to_correct = 139,
  map_response = 301,
}
//"deviceStatus":{"120":0,"121":8,"122":100,"123":110,"124":209,"125":99,"126":96,"127":97,"128":0,"133":1,"134":1,"135":0,"139":0}
