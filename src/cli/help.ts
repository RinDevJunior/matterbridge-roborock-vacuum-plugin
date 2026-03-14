export const HELP_TEXT = `
Usage:
  npm run cli -- --command <command> [options]

Commands:
  login                                                   Authenticate and save session
  devices                                                 List all devices
  status   --duid <duid>                                  Get device status via MQTT
  start    --duid <duid>                                  Start cleaning
  stop     --duid <duid>                                  Stop cleaning and return to dock
  pause    --duid <duid>                                  Pause cleaning
  ping     --duid <duid>                                  Beep robot to locate it (find_me)
  rooms    --duid <duid>                                  Get room mapping (active map)
  map-info --duid <duid>                                  Get all maps with rooms
  custom   --duid <duid> --method <method>                Send/get a custom MQTT command
           [--params <json>] [--send true]                  --send true = fire-and-forget
  help                                                    Show this help message

Examples:
  npm run cli -- --command login
  npm run cli -- --command devices
  npm run cli -- --command status   --duid <duid>
  npm run cli -- --command start    --duid <duid>
  npm run cli -- --command ping     --duid <duid>
  npm run cli -- --command rooms    --duid <duid>
  npm run cli -- --command map-info --duid <duid>
  npm run cli -- --command custom   --duid <duid> --method get_status
  npm run cli -- --command custom   --duid <duid> --method set_clean_motor_mode --params '[{"fan_power":102}]' --send true
`;
