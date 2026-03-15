const b = '\x1b[1m'; // bold
const c = '\x1b[36m'; // cyan
const y = '\x1b[33m'; // yellow
const g = '\x1b[32m'; // green
const d = '\x1b[2m'; // dim
const r = '\x1b[0m'; // reset

const NAME_WIDTH = 15;

function row(name: string, args: string, desc: string): string {
	const paddedName = name.padEnd(NAME_WIDTH);
	const paddedArgs = args.padEnd(36);
	return `  ${g}${paddedName}${r}${d}${paddedArgs}${r}${desc}`;
}

export const HELP_TEXT = `
${b}Usage:${r}
  npm run cli -- --command ${c}<command>${r} [options]

${b}Options:${r}
  ${y}--help ${r}   Show this help message
  ${y}--debug${r}   Enable debug logging
  ${y}--local${r}   Send commands via local network (TCP) instead of MQTT

${b}Commands:${r}
${row('login', '', 'Authenticate and save session')}
${row('devices', '', 'List all devices')}
${row('status', '--duid <duid>', 'Get device status via MQTT')}
${row('start', '--duid <duid>', 'Start cleaning')}
${row('stop', '--duid <duid>', 'Stop cleaning and return to dock')}
${row('pause', '--duid <duid>', 'Pause cleaning')}
${row('resume', '--duid <duid>', 'Resume cleaning')}
${row('ping', '--duid <duid>', 'Beep robot to locate it (find_me)')}
${row('clean-mode', '--duid <duid>', 'Get current clean mode settings')}
${row('room-info', '--duid <duid>', 'Get room mapping (active map)')}
${row('map-info', '--duid <duid>', 'Get all maps with rooms')}
${row('scenes', '--duid <duid> [--detail]', 'List cleaning scenes/routines')}
${row('network-info', '--duid <duid>', 'Get WiFi/network info')}
${row('custom', '--duid <duid> --method <method>', 'Send/get a custom MQTT command')}
${' '.repeat(2 + NAME_WIDTH)}${d}[--params <json>] [--send true]   ${r}--send true = fire-and-forget

${b}Examples:${r}
  npm run cli -- ${y}--help${r}
  npm run cli -- --command ${g}login${r}
  npm run cli -- --command ${g}devices${r}
  npm run cli -- --command ${g}status     ${r}--duid ${c}<duid>${r}
  npm run cli -- --command ${g}start      ${r}--duid ${c}<duid>${r}
  npm run cli -- --command ${g}ping       ${r}--duid ${c}<duid>${r}
  npm run cli -- --command ${g}room-info  ${r}--duid ${c}<duid>${r}
  npm run cli -- --command ${g}map-info   ${r}--duid ${c}<duid>${r}
  npm run cli -- --command ${g}custom     ${r}--duid ${c}<duid>${r} --method get_prop --params '["get_status"]'
  npm run cli -- --command ${g}custom     ${r}--duid ${c}<duid>${r} --method set_clean_motor_mode --params '[{"fan_power":102}]' --send true
`;
