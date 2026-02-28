# Changelog

All notable changes to this project will be documented in this file.

---

## [1.1.5-rc03] - 2026-02-28

### Added

- **Full MQTT lifecycle email notifications** — Email notifications now cover all MQTT connection events: connected, offline, close, and error — giving complete visibility into connectivity changes.
- **Extended dock type support** — New `DockType` enum values added for broader dock hardware compatibility.

### Fixed

- **State resolution priority for Cleaning** — Fixed incorrect state priority order: `isLocating`/`isExploring` now takes precedence over `inWarmup`, which takes precedence over `inReturning`, matching actual device behaviour.
- **Missing mopping statuses in area check** — The guard that resets `currentArea` and `selectedAreas` when no `cleaningInfo` is present now covers all mopping and combined clean+mop operation codes (`RoomMopping`, `ZoneMopping`, `CleanMopCleaning`, `CleanMopMopping`, and their room/zone variants). Previously these states bypassed the check, leaving stale area data in Matter.

### Improved

- **Connection lifecycle clarity** — `AbstractConnectionListener` now exposes `onOffline` and `onClose` as distinct callbacks instead of a single `onDisconnected`, allowing listeners to distinguish a network loss from an explicit connection close.
- **Reduced response noise** — `V1ResponseBroadcaster` now silently drops simple ok responses, cutting down on redundant log output.
- **Message result type safety** — `MessageResult` now uses strongly-typed enums (`OperationStatusCode`, `DockType`, etc.) instead of raw numeric values, reducing the risk of mis-mapped states.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.5-rc02] - 2026-02-27

### Added

- **Email notification test on startup** — When email notifications are enabled, the plugin now sends a test email on `onConfigure` to verify the SMTP settings are correct. A successful email confirms your configuration is working.
- **Device OTA status handling** — The plugin now handles protocol 500 (`device_status_ota`) messages from the device. Firmware update status, progress, and device online/offline events are logged automatically.

### Fixed

- **Local client stale socket race condition** — Replaced the `intentionalDisconnect` flag (shared mutable state, time-sensitive) with a closure-captured socket reference in `close`, `error`, and `end` event handlers. When a ping-timeout reconnect fires, the old socket's async `close` event is now rejected via identity check (`this.socket !== socket`), preventing it from destroying the newly created socket mid-handshake.
- **MQTT fallback during local reconnect** — While the local client is reconnecting, `ClientRouter` now falls back to MQTT and emits a notice log instead of silently failing or waiting.
- **`ConnectionBroadcaster` now requires a logger** — Constructor updated to accept `AnsiLogger`; `register` and `unregister` now emit notice logs for observability.
- **`ClientRouter` field rename** — `connectionListener` renamed to `connectionBroadcaster` for naming consistency with `AbstractClient`.
- **`DisconnectNotificationListener` stub methods** — `onConnected`, `onError`, and `onReconnect` now log the duid at debug level instead of being empty stubs.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.5-rc01] - 2026-02-23

### Added

- **Per-device model name override** — When "Override Matter Configuration" is enabled, the plugin now auto-populates `deviceProductNames` in the config on first run with each device's serial number and model as the default name. Edit any entry to customise the model name shown in Apple Home per device. Per-device names take priority over the global default product name.
- **Burst polling after vacuum commands** — After triggering a vacuum action (start, resume, go home), the plugin polls the device every 10 seconds until it reaches an idle/docked state. This ensures Matter reflects the latest state promptly after a command, without relying solely on MQTT or periodic refresh. Polling is scoped per device and auto-starts when the device transitions to a Cleaning or Mapping state.

### Fixed

- **Charging state regression** — `handleDeviceStatusUpdate` no longer overrides `Charging` with `Docked` while the device is still on the dock charging. The transition from `Charging → Docked` is now owned exclusively by `handleBatteryUpdate` once the battery reaches full charge.

### Improved

- **Apple Home label clarity** — Schema labels for the Matter Configuration Override section now consistently reference "Apple Home" and "Model Name" to make it clearer what each setting affects.
- **Device name simplification** — Device name no longer appends the DUID suffix, reducing visual noise in device listings.
- **Serial number detection** — V10-protocol devices now fetch the serial number via `get_serial_number` on first startup. Q7/Q10 devices fall back to the DUID as the serial number.
- **Burst polling visibility** — Notice logs are now emitted when burst polling starts and stops per device, making it easier to trace polling activity in logs.
- **Richer state resolution log** — The resolved state notice now includes raw `runMode` and `operationalState` numeric values alongside human-readable names for easier debugging.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4] - 2026-02-22

### Breaking Changes

- **Node.js 24 required** — This release requires Node.js `>=24 <25`. If you are running Node.js 22 or earlier, you must upgrade before installing this version.
- **Matterbridge 3.5.5 required** — This release requires Matterbridge `^3.5.5`. Please update Matterbridge before updating the plugin.

### Added

- **Configurable Matter device identity** — New "Override Matter Configuration" option under Advanced Features. When enabled, you can set a custom vendor name, vendor ID, product name, and product ID used during Matter device discovery, replacing the plugin defaults.
- **Vacuum error status control** — New "Include Vacuum Error Status" option under Advanced Features. When disabled (default), vacuum error events are ignored, preventing unnecessary error state changes in Matter. Enable it to have vacuum and dock errors reported through Matter operational state.
- **Automatic restart after clearing storage** — After clearing persistence storage, the plugin now prompts an automatic restart via WebSocket instead of requiring manual intervention.

### Fixed

- **Offline devices not registered** — Devices that fail to connect to the local network are now registered in Matterbridge in MQTT-only mode instead of being silently skipped. Previously, multiple vacuums where only one was on the local network could result in the other never appearing.
- **Routine cleaning triggered wrong scene** — `buildCleanCommand` now correctly subtracts the area ID offset before passing it to `startScene`, fixing routines doing nothing or triggering the wrong scene.
- **Plugin startup crash on old configs** — Fixed `TypeError: Cannot read properties of undefined (reading 'overrideMatterConfiguration')` when an existing config had an `advancedFeature` object without a nested `settings` block.
- **Communication crash on primitive result** — Fixed `Cannot use 'in' operator to search for 'state' in 104` crash when a device returns a primitive value instead of a status object.
- **MQTT commands failing silently** — Fixed commands that could fail with no error due to a missing protocol version on outgoing requests.
- **Race condition on disconnect** — Fixed an issue where device disconnection could cause unexpected reconnection loops.

### Improved

- **Multi-device MQTT-only support** — Devices unable to join the local network now fully participate via MQTT, with correct per-device message routing using DUID filtering.
- **Multiple map active map detection** — The plugin now correctly identifies which map is active when multiple maps are saved. Rooms are matched to the correct map using room ID and name mappings.
- **Device name uniqueness** — Device name now appends the DUID suffix (`{name}-{duid}`) to prevent name collisions when multiple vacuums share the same display name.
- **Broader device compatibility** — Devices that do not report a serial number are now fully supported. The plugin uses `duid` as the device identifier across all models.
- **Dock station error reporting** — Dock errors (water tank empty, dust bin full, brush jammed, etc.) are now reported through Matter operational state.
- **"Vacuum then Mop" mode visibility** — The combined mode is now only shown on devices that support it, giving a more accurate mode list per device.
- **Better 2FA experience** — Two-factor authentication now shows a clear toast notification with verification code instructions.
- **Improved connection readiness** — The plugin now validates that both `isReady()` and `isConnected()` are true before sending commands, reducing failed requests after reconnects.
- **Reduced API polling** — Devices with an active real-time connection no longer trigger unnecessary periodic data requests.
- **Clean mode architecture** — Clean mode capability registration is now centralized into `DeviceCapabilityRegistry` for better maintainability across all device models.

### Internal

- Added troubleshooting guide for the stuck-at-updating issue (`troubleshoot/STUCK_AT_UPDATING_ISSUE.md`).
- Extracted Hawk authentication into private methods matching the Python reference implementation.
- Refactored start cleaning flow and routine cleaning into `roborockService` for clearer responsibility.
- Expanded unit test coverage across platform, communication, routing, and service modules.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc14] - 2026-02-21

### Fixed

- **Offline device not registered** — Devices that fail local network connection (e.g. `online: false`) are now registered in Matterbridge in MQTT-only mode instead of being silently skipped. Previously, a failed `get_network_info` request caused an early return, resulting in only one device appearing when multiple vacuums were configured.
- **Message routing DUID filtering** — `V1ResponseBroadcaster` and `B01ResponseBroadcaster` now filter incoming messages by `duid` before dispatching to listeners, preventing messages intended for one device from being routed to another device's listeners.
- **Multiple map active map update** — `getRoomMap` is now only called when `isMultipleMapEnabled` is enabled, avoiding unnecessary MQTT requests for single-map setups.
- **`SimpleMessageListener` crash on non-object result** — Fixed `Cannot use 'in' operator to search for 'state' in 104` error when a device returns a primitive value (e.g. `result: [104]`) instead of a status object. Added `typeof` guard before the `'state' in messageBody` check.

### Improved

- **MQTT connection readiness check** — `initializeMessageClient` now waits for both `isReady()` and `isConnected()` before proceeding, ensuring the MQTT connection is fully established.
- **MQTT topic logging** — The full MQTT publish topic is now included in the debug log for easier tracing.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc13] - 2026-02-21

### Refactored

- **Clean mode registration** — Centralized clean mode capability registration into `DeviceCapabilityRegistry`, replacing scattered registration logic across multiple handlers. Improved type safety and readability across `cleanModeConfig`, `cleanModeUtils`, `modeResolver`, and related handlers.

### Internal

- Minor code cleanup in `behaviorConfig.ts` and `runtimeHelper.ts`.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc12] - 2026-02-21

### Fixed

- **Device name uniqueness** — Device name now includes the `duid` suffix (`{name}-{duid}`) with whitespace stripped, preventing name collisions when multiple vacuums share the same display name.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc11] - 2026-02-21

### Fixed

- **Routine scene ID off-by-offset** — `buildCleanCommand` now subtracts `SCENE_AREA_ID_MIN` from the Matter `areaId` before passing it to `startScene`, recovering the correct Roborock scene ID. Previously the Matter offset was included, causing the wrong scene to be triggered and the vacuum doing nothing.
- **`startScene` response parsing** — `startScene` now checks `apiResponse.success` instead of `apiResponse.result`. The Roborock execute-scene endpoint returns `{"success": true}` with no `result` field; the old check always evaluated to falsy and logged a false failure even when the API call succeeded.

### Internal

- Extracted Hawk authentication logic into private `getHawkAuthentication` and `processExtraHawkValues` methods on `RoborockIoTApi`, matching the Python reference implementation. Nonce now uses URL-safe base64url encoding and the header format matches the Python library exactly.
- Added `success` and `status` fields to `ApiResponse<T>`.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc10] - 2026-02-21

### Fixed

- **Device identifier consistency** — `RoborockVacuumCleaner` now always uses `duid` as the device identifier instead of falling back to `serialNumber`. This ensures consistent device identity across all models, including those that do not report a serial number.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc09] - 2026-02-20

### Fixed

- **Plugin startup crash on old configs** — Fixed `TypeError: Cannot read properties of undefined (reading 'overrideMatterConfiguration')` that occurred when an existing config had an `advancedFeature` object without a nested `settings` block. Advanced feature settings are now safely accessed via config manager methods with proper `?? false` fallbacks, and `matterOverrideSettings` always returns a non-undefined value.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc08] - 2026-02-20

### Added

- **Configurable Matter vendor/product ID** — New "Override Matter Configuration" option under Advanced features. When enabled, you can set a custom vendor name, vendor ID, product name, and product ID used during Matter device discovery, replacing the plugin defaults.
- **Troubleshooting guide for stuck-at-updating issue** — Added a detailed guide (`troubleshoot/STUCK_AT_UPDATING_ISSUE.md`) to help diagnose and resolve network switch compatibility problems that can cause the plugin to get stuck at the "Updating" phase.

### Fixed

- **Message listener stability** — `SimpleMessageListener` now silently ignores invalid or malformed messages instead of failing, improving overall communication reliability.

### Improvements

- **Multi-map active map detection** — The plugin now correctly identifies which map is currently active when multiple maps are saved on the vacuum. Rooms are matched to the right map using room ID and name mappings, ensuring accurate area reporting.
- **Cleaner start cleaning flow** — Cleaning initialization logic has been consolidated from `messageRoutingService` into `roborockService` for clearer responsibility and easier maintenance.
- **Routine cleaning refactored** — The routine cleaning method has been restructured with a cleaner separation of concerns across `roborockService`, `areaManagementService`, and `messageRoutingService`.

### Internal

- Formatted `roborockService.changeCleanMode` for improved readability.
- Added `roomMapInfoListener` to handle room-to-map data updates from device messages.
- Updated tests for `MapInfo`, `RoomIndexMap`, `getSupportedAreas`, `platformRunner`, area management, and routing services.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc07] - 2026-02-18

### Added

- **Vacuum error status control** — New "Include Vacuum Error Status" option under Advanced features. When disabled (default), vacuum error events are ignored, preventing unnecessary error state changes in Matter. Enable it to have vacuum and dock station errors reported through Matter operational state.

### Internal

- Added `includeVacuumErrorStatus` to schema, config type, config manager, and platform runner.
- Updated all test fixtures to include the new configuration property.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc06] - 2026-02-17

### Improvements

- **Better notification experience** — Two-factor authentication now shows a toast notification with clear verification code instructions, so you never miss when action is needed.
- **Clearer status messages** — Notifications throughout the plugin now display with severity levels (success, warning, info) for easier visual distinction.
- **Automatic restart after clearing storage** — After clearing persistence storage, the plugin now prompts an automatic restart via WebSocket instead of requiring you to do it manually.
- **Expanded device compatibility** — Devices that do not report a serial number are now properly supported. `DeviceRegistry` uses `duid` instead of serial number as the device identifier.
- **Improved command reliability** — Communication between the plugin and your vacuum is now more dependable. `MQTTClient` and `LocalClient` now use `tryResolve` for better response tracking, reducing missed or dropped commands.
- **Broader protocol support** — The plugin now handles multiple device communication protocols more cleanly, improving compatibility across different Roborock models (including B01 series devices). Introduced `V1ResponseBroadcaster`, `B01ResponseBroadcaster`, and `ResponseBroadcasterFactory` to dynamically select the correct handler based on protocol version.
- **Device status retrieval** — Added support for fetching device status from additional protocol versions, enabling more accurate state reporting. `Q7MessageDispatcher` now supports `getDeviceStatus` for retrieving device status properties.

### Added

- Added Buy Me a Coffee badge for project funding support.

### Internal

- Refactored response handling into protocol-specific components (`V1PendingResponseTracker`, `B01PendingResponseTracker`) for better maintainability.
- Refactored `MessageDispatcherFactory` to support new protocol versions with improved error handling; removed unused `protocolCalculator` module.
- Added comprehensive unit tests for `B01ResponseBroadcaster`, `B01PendingResponseTracker`, and `MessageDispatcherFactory`.

<a href="https://www.buymeacoffee.com/rinnvspktr" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>

---

## [1.1.4-rc05] - 2026-02-17

### Improvements

- Reduced unnecessary API polling — devices with active real-time connections no longer trigger periodic data requests, improving responsiveness and lowering network overhead.
- The "Vacuum then Mop" clean mode is now only shown on devices that support it, giving a more accurate mode list per device.
- Dock station errors (e.g., water tank empty, dust bin full, brush jammed) are now reported through Matter operational state, so your smart home controller can display them.
- Plugin status notifications are now more reliable — if the primary notification channel is unavailable, messages fall back gracefully to alternative channels.
- Device connection retry logic is now more tolerant of slow networks, reducing premature connection failures.
- Improved connection stability — the plugin now validates that a device is fully ready before sending commands, reducing failed requests after reconnects.
- Fixed a race condition during device disconnection that could cause unexpected reconnection loops.

### Bug Fixes

- Fixed an issue where MQTT commands could fail silently due to a missing protocol version on outgoing requests.
- Fixed an issue with the npm publish workflow that caused provenance signing errors during release.

### Internal

- Strengthened type safety across platform runner lifecycle management.
- Expanded and updated unit test coverage across connection, communication, and platform modules.

---

## [1.1.4-rc04] - 2026-02-16

### Added

- `LocalPingResponseListener` for local network ping response handling.
- Unit tests for `LocalPingResponseListener` and `cleanModeUtils`.
- Room mapping validation in `Q10MessageDispatcher` tests.

### Changed

- Improved connection handling in `MQTTClient` and `LocalNetworkClient`.
- Renamed `PingResponseListener` to `LocalPingResponseListener`.
- Updated protocol version management.

### Fixed

- Checkout specific release tag in publish workflow to resolve sigstore provenance error.

---

## [1.1.3-rc05] - 2026-01-31

### Changed

- Bumped version to `1.1.3-rc05`.
- Updated `matterbridge-roborock-vacuum-plugin.schema.json` and `matterbridge-roborock-vacuum-plugin.config.json` to the new version.
- Updated `buildpackage` script to use `matterbridge-roborock-vacuum-plugin-1.1.3-rc05.tgz`.
- Updated docs and internal references.

---

## [1.1.0-rc15] - 2025-07-26

### Changed

- Refactor codebase.
- Correct LocalNetworkClient connecting process.
- Update and fix unit tests.
- Various lint fixes.

## [1.1.0-rc14] - 2025-07-26

### Added

- Initialize sync device status via MQTT.

## [1.1.0-rc13] - 2025-07-25

### Added

- More unit tests.
- Increased unit test coverage.

### Fixed

- Several bugs related to socket connection issues.
- Improve reconnect logic and cleaning status reporting.

## [1.1.0-rc11] - 2025-07-22

### Fixed

- Unable to get room from `get_room_mapping`.
- Can not get room from `get_multi_maps_list`.

## [1.1.0-rc10] - 2025-07-22

### Fixed

- Stop retrying to connect socket when exceeding retry count.
- Lint and unit test updates.

## [1.1.0-rc09] - 2025-07-20

### Fixed

- Do not re-connect MQTT unnecessarily.
- Reconnect when socket or MQTT is unexpectedly disconnected.

### Enhanced

- Save user data for subsequent logins.
- Unit test improvements.

## [1.1.0-rc07] - 2025-07-17

### Changed

- Enable server mode fixes.
- Improved error logging when plugin can't connect to device.

## [1.1.0-rc06] - 2025-07-16

### Fixed

- Can not start plugin when server mode is disabled.

## [1.1.0-rc04] - 2025-07-16

### Added

- Unit tests.
- GitHub Actions improvements.

---

**Note:** This changelog includes only the most recent 30 commits. For the full commit history, view more on [GitHub](https://github.com/RinDevJunior/matterbridge-roborock-vacuum-plugin/commits?sort=updated&direction=desc).
