# Roborock CLI — Developer Debug Tool

A standalone CLI to interact with the Roborock API and control vacuum devices directly, without running the full Matterbridge plugin. Useful for debugging, testing API responses, and sending commands during development.

---

## Setup

Build the project first:

```bash
npm run build:local
```

---

## Usage

```bash
npm run cli -- --command <command> [--duid <duid>] [--debug]
```

| Option    | Description                                           |
| --------- | ----------------------------------------------------- |
| `--help`  | Show help message                                     |
| `--debug` | Enable debug logging                                  |
| `--local` | Send commands via local network (TCP) instead of MQTT |

---

## Commands

| Command                         | Arguments                                                    | Description                     |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| [`login`](#login)               | —                                                            | Authenticate and save session   |
| [`devices`](#devices)           | —                                                            | List all devices                |
| [`status`](#status)             | `--duid <duid>`                                              | Get device status via MQTT      |
| [`start`](#start)               | `--duid <duid>`                                              | Start cleaning                  |
| [`stop`](#stop)                 | `--duid <duid>`                                              | Stop cleaning                   |
| [`pause`](#pause)               | `--duid <duid>`                                              | Pause cleaning                  |
| [`resume`](#resume)             | `--duid <duid>`                                              | Resume cleaning                 |
| [`ping`](#ping)                 | `--duid <duid>`                                              | Beep robot (find_me)            |
| [`clean-mode`](#clean-mode)     | `--duid <duid>`                                              | Get current clean mode settings |
| [`room-info`](#room-info)       | `--duid <duid>`                                              | Get room mapping (active map)   |
| [`map-info`](#map-info)         | `--duid <duid>`                                              | Get all maps with rooms         |
| [`scenes`](#scenes)             | `--duid <duid> [--detail]`                                   | List cleaning scenes/routines   |
| [`network-info`](#network-info) | `--duid <duid>`                                              | Get WiFi/network info           |
| [`custom`](#custom)             | `--duid <duid> --method <m> [--params <json>] [--send true]` | Send/get custom command         |
| [`--help`](#help)               | —                                                            | Show help message               |

---

### `login`

Authenticate with your Roborock account. Sends a verification code to your email.

```bash
npm run cli -- --command login
```

Prompts:

```
Email: your@email.com
Sending verification code...
Verification code: 123456
```

On success, saves session to `.cli-session.json` and lists discovered devices:

```
Logged in as: your@email.com
Session saved. Found 2 device(s).
  • abc123  Living Room Vacuum  model=roborock.vacuum.a08  pv=A01
  • def456  Bedroom Vacuum      model=roborock.vacuum.a15  pv=B01
```

> Session is stored locally in `.cli-session.json` (gitignored). Re-run `login` if the session expires.

---

### `devices`

List all devices in your home. Refreshes the device list in the session.

```bash
npm run cli -- --command devices
```

Output:

```
Found 2 device(s):
  duid:   abc123
  name:   Living Room Vacuum
  model:  roborock.vacuum.a08
  pv:     A01
  online: true

  duid:   def456
  name:   Bedroom Vacuum
  model:  roborock.vacuum.a15
  pv:     B01
  online: false
```

---

### `status`

Get the current status of a device via MQTT.

```bash
npm run cli -- --command status --duid <duid>
```

Example:

```bash
npm run cli -- --command status --duid abc123
```

Output:

```json
Device status: {
  "state": 8,
  "battery": 100,
  "clean_time": 0,
  ...
}
```

---

### `start`

Start cleaning.

```bash
npm run cli -- --command start --duid <duid>
```

---

### `stop`

Stop cleaning and return to dock.

```bash
npm run cli -- --command stop --duid <duid>
```

---

### `pause`

Pause cleaning in place.

```bash
npm run cli -- --command pause --duid <duid>
```

---

### `resume`

Resume cleaning after pause.

```bash
npm run cli -- --command resume --duid <duid>
```

---

### `ping`

Beep the robot to locate it (`find_me`).

```bash
npm run cli -- --command ping --duid <duid>
```

---

### `clean-mode`

Get the current clean mode settings (suction power, water flow, mop route).

```bash
npm run cli -- --command clean-mode --duid <duid>
```

Output:

```
Clean mode for device abc123:

  suction_power: 102
  water_flow:    200
  distance_off:  0
  mop_route:     300
  sequence_type: (not supported)
```

---

### `scenes`

List all cleaning scenes/routines configured for the device's home. Use `--detail` to include the raw `param` field.

```bash
npm run cli -- --command scenes --duid <duid>
npm run cli -- --command scenes --duid <duid> --detail true
```

Output:

```
Scenes for device abc123:

  id=1  name=Daily Clean  type=cleanScene  enabled=true
  id=2  name=Bedroom      type=cleanScene  enabled=false
```

---

### `room-info`

Get room mapping for a device. Shows room IDs, tags, and names — useful for debugging room IDs before using room-based cleaning.

```bash
npm run cli -- --command room-info --duid <duid>
```

Output (multi-map device):

```
Room mapping for device abc123:

Map: Default Map 1 (id=0)
  id=16  tag=4  iot_name_id=abc  name=Living Room
  id=17  tag=5  iot_name_id=def  name=Kitchen
```

Output (fallback for devices without multi-map support):

```
Room mapping for device abc123:

Room mapping (fallback):
  id=16  tag=4  iot_name_id=abc  name=Living Room
```

---

### `map-info`

Get map info for a device. Shows all maps with their IDs, names, and room-info per map.

```bash
npm run cli -- --command map-info --duid <duid>
```

Output:

```
Map info for device abc123:

Map: Default Map 1 (id=0)  room-info=2
  id=16  tag=4  iot_name_id=abc  name=Living Room
  id=17  tag=5  iot_name_id=def  name=Kitchen
```

---

### `network-info`

Get WiFi and network info for a device (SSID, IP, MAC, BSSID, signal strength).

```bash
npm run cli -- --command network-info --duid <duid>
```

Output:

```
Network info for device abc123:

  ssid:  MyWiFi
  ip:    192.168.1.42
  mac:   AA:BB:CC:DD:EE:FF
  bssid: 11:22:33:44:55:66
  rssi:  -55 dBm
```

> Note: Not supported on all device protocols (Q7, Q10). Returns a message if unsupported.

---

### `custom`

Send or get a custom MQTT command with optional params.

| Argument      | Required | Description                             |
| ------------- | -------- | --------------------------------------- |
| `--duid`      | yes      | Device ID                               |
| `--method`    | yes      | RPC method name (e.g. `get_status`)     |
| `--params`    | no       | JSON-encoded params array or object     |
| `--send true` | no       | Fire-and-forget (default: get response) |

**Get response:**

```bash
npm run cli -- --command custom --duid <duid> --method get_status
```

```bash
npm run cli -- --command custom --duid <duid> --method get_clean_summary --params '[{"start_time":0}]'
```

Output:

```json
Response: {
  "clean_time": 3600,
  "clean_area": 12000,
  ...
}
```

**Fire-and-forget (send only, no response):**

```bash
npm run cli -- --command custom --duid <duid> --method set_clean_motor_mode --params '[{"fan_power":102}]' --send true
```

Output:

```
Sent: set_clean_motor_mode
```

**Debugging Q7/Q10 protocol devices:**

```bash
# Query raw status (Q7/Q10)
npm run cli -- --command custom --duid <duid> --method get_prop --params '["get_status"]'

# Query map list (Q7)
npm run cli -- --command custom --duid <duid> --method service.get_map_list

# Query room mapping backup (Q7)
npm run cli -- --command custom --duid <duid> --method service.get_room_mapping_backup_1
```

---

### `help`

Show all available commands and examples.

```bash
npm run cli -- --help
```

---

## Typical Workflow

```bash
# 1. Build
npm run build:local

# 2. Login once
npm run cli -- --command login

# 3. List devices to get duid
npm run cli -- --command devices

# 4. Send commands
npm run cli -- --command status --duid abc123
npm run cli -- --command room-info  --duid abc123
npm run cli -- --command start  --duid abc123
npm run cli -- --command pause  --duid abc123
npm run cli -- --command stop   --duid abc123

# 5. Debug mode (verbose logging)
npm run cli -- --command status --duid abc123 --debug
```

---

## Session File

After `login`, credentials are cached in `.cli-session.json` at the project root. This file is gitignored and contains your `UserData` and device list. Delete it to force re-login.

---

## Notes

- Commands that control the vacuum (`status`, `start`, `stop`, `pause`) connect via MQTT and time out after **10 seconds** if the device is unreachable.
- Use `--local` to route commands over the local TCP connection (port 58867) instead of MQTT. The device IP is fetched automatically via `get_network_info`. Not supported on Q7/Q10 protocol devices.
- The default authentication endpoint is `https://usiot.roborock.com` (US region). If your account is in EU/CN/RU, the API resolves the correct regional URL automatically after providing your email.
- Log output is suppressed by default (level `DEBUG`). Internal API/MQTT logs will not appear unless there is a warning or error.
