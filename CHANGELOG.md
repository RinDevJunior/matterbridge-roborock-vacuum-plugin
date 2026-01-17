# Changelog

All notable changes to this project will be documented in this file.

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
