# Changelog

All notable changes to this project will be documented in this file.

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
