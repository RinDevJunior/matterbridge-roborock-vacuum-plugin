export const HELP_TEXT = `Usage: npm run cli -- --command <command> [--duid <duid>]

Commands:
  login                    Authenticate and save session
  devices                  List devices (refreshes session)
  status  --duid <duid>    Get device status via MQTT
  start   --duid <duid>    Start cleaning
  stop    --duid <duid>    Stop cleaning
  pause   --duid <duid>    Pause cleaning
  rooms    --duid <duid>                              Get room mapping (active map)
  map-info --duid <duid>                              Get map info (all maps + rooms)
  custom   --duid <duid> --method <method>            Get custom command response
           [--params <json>] [--send true]            Use --send true to fire-and-forget
  help                                               Show this help message

Examples:
  npm run cli -- --command login
  npm run cli -- --command devices
  npm run cli -- --command status   --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command start    --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command rooms    --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command map-info --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command custom   --duid YBqkooSOUKiJd5HiCFOAS --method get_status
  npm run cli -- --command custom   --duid YBqkooSOUKiJd5HiCFOAS --method set_clean_motor_mode --params '[{"fan_power":102}]' --send true`;
