export const HELP_TEXT = `Usage: npm run cli -- --command <command> [--duid <duid>]

Commands:
  login                    Authenticate and save session
  devices                  List devices (refreshes session)
  status  --duid <duid>    Get device status via MQTT
  start   --duid <duid>    Start cleaning
  stop    --duid <duid>    Stop cleaning
  pause   --duid <duid>    Pause cleaning
  rooms   --duid <duid>    Get room mapping
  help                     Show this help message

Examples:
  npm run cli -- --command login
  npm run cli -- --command devices
  npm run cli -- --command status --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command start  --duid YBqkooSOUKiJd5HiCFOAS
  npm run cli -- --command rooms  --duid YBqkooSOUKiJd5HiCFOAS`;
