<!-- markdownlint-disable MD024 MD033 -->

# <img src="matterbridge.svg" alt="Matterbridge Logo" width="64px" height="64px">&nbsp;&nbsp;&nbsp;Matterbridge dynamic platform example plugin changelog

[![npm version](https://img.shields.io/npm/v/matterbridge-example-dynamic-platform.svg)](https://www.npmjs.com/package/matterbridge-example-dynamic-platform)
[![npm downloads](https://img.shields.io/npm/dt/matterbridge-example-dynamic-platform.svg)](https://www.npmjs.com/package/matterbridge-example-dynamic-platform)
[![Docker Version](https://img.shields.io/docker/v/luligu/matterbridge?label=docker%20version&sort=semver)](https://hub.docker.com/r/luligu/matterbridge)
[![Docker Pulls](https://img.shields.io/docker/pulls/luligu/matterbridge.svg)](https://hub.docker.com/r/luligu/matterbridge)
![Node.js CI](https://github.com/Luligu/matterbridge-example-dynamic-platform/actions/workflows/build-matterbridge-plugin.yml/badge.svg)
![CodeQL](https://github.com/Luligu/matterbridge-example-dynamic-platform/actions/workflows/codeql.yml/badge.svg)
[![codecov](https://codecov.io/gh/Luligu/matterbridge-example-dynamic-platform/branch/main/graph/badge.svg)](https://codecov.io/gh/Luligu/matterbridge-example-dynamic-platformr)

[![power by](https://img.shields.io/badge/powered%20by-matterbridge-blue)](https://www.npmjs.com/package/matterbridge)
[![power by](https://img.shields.io/badge/powered%20by-matter--history-blue)](https://www.npmjs.com/package/matter-history)
[![power by](https://img.shields.io/badge/powered%20by-node--ansi--logger-blue)](https://www.npmjs.com/package/node-ansi-logger)
[![power by](https://img.shields.io/badge/powered%20by-node--persist--manager-blue)](https://www.npmjs.com/package/node-persist-manager)

---

All notable changes to this project will be documented in this file.

If you like this project and find it useful, please consider giving it a star on [GitHub](https://github.com/Luligu/matterbridge-example-dynamic-platform) and sponsoring it.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="120"></a>

## [2.0.3] - 2025-12-25

### Added

- [DevContainer]: Refactored Dev Container setup. The Matterbridge instance can now be paired on native Linux hosts or WSL 2 with Docker engine CLI integration. On Docker Desktop on Windows or macOS is not possible cause Docker Desktop runs inside a VM and not directly on the host so mDNS is not supported.
- [DevContainer]: Since is now possible to pair from Dev Container, named volumes have been added to persist storage and plugins across rebuilds.

### Changed

- [package]: Updated dependencies.
- [package]: Bumped package to automator v.2.1.1.

### Fixed

- [doorLock]: Fix test for doorLock. Thanks Ludovic BOUÉ (<https://github.com/Luligu/matterbridge-example-dynamic-platform/pull/40>).

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [2.0.2] - 2025-12-05

### Changed

- [package]: Updated dependencies.
- [package]: Updated to the current Matterbridge signatures.
- [package]: Requires Matterbridge v.3.4.0.
- [package]: Updated tests to use the Matterbridge Jest module.
- [package]: Bumped package to automator v.2.1.0.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [2.0.1] - 2025-11-13

### Changed

- [package]: Updated dependencies.
- [package]: Bumped package to automator v.2.0.12.
- [jest]: Updated jestHelpers to v.1.0.12.
- [workflows]: Use shallow clones and --no-fund --no-audit for faster builds.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [2.0.0] - 2025-10-24

### Changed

- [package]: Bumped platform to v. 2.0.0.
- [package]: Updated dependencies.
- [package]: Bumped package to automator version 2.0.9
- [jest]: Updated jestHelpers to v. 1.0.9.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.4.0] - 2025-10-15

### Added

- [jest]: Added jest helper module v. 1.0.6.
- [platform]: Added a thermostat with auto mode and occupancy and outdoorTemperature.
- [platform]: Added animation to Heat pump. Thanks Ludovic BOUÉ (<https://github.com/Luligu/matterbridge-example-dynamic-platform/pull/35>).
- [platform]: Added Toggle thermostatRunningState heat and cool. Thanks Ludovic BOUÉ (<https://github.com/Luligu/matterbridge-example-dynamic-platform/pull/36>).

### Changed

- [package]: Require matterbridge 3.3.0.
- [index]: Updated to new signature PlatformMatterbridge.
- [platform]: Updated to new signature PlatformMatterbridge.
- [package]: Updated dependencies.
- [package]: Bumped package to automator version 2.0.7
- [workflows]: Ignore any .md in build.yaml.
- [workflows]: Ignore any .md in codeql.yaml.
- [workflows]: Ignore any .md in codecov.yaml.
- [template]: Updated bug_report.md.
- [jest]: Updated jestHelpers to v. 1.0.6.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.12] - 2025-09-14

### Added

- [jest]: Added jest helper module v. 1.0.5.
- [rvc]: Added DustBinFull to the Rvc animation (<https://github.com/Luligu/matterbridge-example-dynamic-platform/pull/31>).

### Changed

- [package]: Updated dependencies.
- [package]: Updated to Automator v. 2.0.6.
- [workflows]: Ignore any .md anywhere.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.11] - 2025-09-09

### Changed

- [package]: Updated dependencies.
- [platform]: Removed attributes setting when is managed by the Matterbridge servers. This add support for **Apple Home Adaptive Lighting**. See <https://github.com/Luligu/matterbridge/discussions/390>.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.10] - 2025-09-06

### Added

- [platform]: Added AirConditioner device class from Matterbridge.
- [platform]: Added a Speaker device type.
- [platform]: Added estimatedEndTime to Rvc animation.

### Changed

- [package]: Updated dependencies.
- [package]: Required matterbridge 3.2.6.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.9] - 2025-08-30

### Added

- [platform]: Added a door contact sensor
- [platform]: Added a motion sensor
- [platform]: Added an illuminance sensor
- [platform]: Added a temperature sensor
- [platform]: Added an humidity sensor
- [platform]: Added a pressure sensor
- [platform]: Added a flow sensor
- [platform]: Added a climate sensor with temperature, humidity and pressure
- [platform]: Added a mode select device
- [platform]: Added animation in 10 phases for refrigerator
- [platform]: Added animation in 10 phases for oven
- [platform]: Added animation in 10 phases for rvc

### Changed

- [package]: Updated dependencies.
- [package]: Updated to Automator v. 2.0.5.
- [devContainer]: Updated devContainer with repository name for the container and shallow clone matterbridge for speed and memory optimization.
- [package]: Required matterbridge 3.2.5.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.8] - 2025-08-20

### Added

- [rvc]: Removed the supportedMaps workaround for the RVC maps. Thanks Ludovic BOUÉ (#25).
- [platform]: Added the new MicrowaveOven() device class from Matterbridge.
- [platform]: Added the new Oven() device class from Matterbridge.
- [platform]: Added the new Cooktop() device class from Matterbridge.
- [platform]: Added the new Refrigerator() device class from Matterbridge.
- [platform]: Added the RefrigeratorTag to the Refrigerator(). Thanks Ludovic BOUÉ (#27).

### Changed

- [package]: Updated dependencies.
- [package]: Required matterbridge 3.2.3.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.7] - 2025-08-01

### Added

- [airquality]: Added support of Concentration Measurements for Home app.

### Changed

- [package]: Updated dependencies.

### Fixed

- [platform]: Fixed missed softwareVersion and hardwareVersion. Thanks Tamer.
- [platform]: Fixed missed BridgedDeviceBasicInformation cluster for single class devices. Thanks Tamer.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.6] - 2025-07-25

### Added

- [platform]: Added a Fan with Off High.
- [momentary]: Added 3 other child endpoint to the Momentary Switch to show createDefaultMomentarySwitchClusterServer(). It creates a single click only switch. It is supported by the Home app.
- [platform]: Refactor platform code to improve readability.

### Changed

- [package]: Updated dependencies.
- [package]: Required matterbridge 3.1.7.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.5] - 2025-07-22

### Added

- [platform]: Changed to the new ExtratorHood() and Dishwasher() from Matterbridge.
- [platform]: Added a Fan with On Off Low Med High.
- [platform]: Added a Fan with complete set of features.

### Changed

- [package]: Updated dependencies.
- [package]: Required matterbridge 3.1.6.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.3] - 2025-07-20

### Added

- [platform]: Add RVC supportedMaps attribute. Thanks Ludovic BOUÉ (#21).

### Changed

- [package]: Updated dependencies.
- [package]: Required matterbridge 3.1.5.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.2] - 2025-07-06

### Added

- [platform]: Add by default Rvc in mode server for Apple Home issue.

### Changed

- [package]: Updated dependencies.
- [package]: Require matterbridge 3.1.2.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.1] - 2025-07-04

### Added

- [platform]: Added solarPower device type (not supported by the Home app).
- [platform]: Added batteryStoraga device type (not supported by the Home app).
- [platform]: Added heatPump device type (not supported by the Home app).

### Changed

- [platform]: Changed imports from matterbridge/devices.
- [package]: Require matterbridge 3.1.1.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.3.0] - 2025-06-25

### Added

- [DevContainer]: Added support for the **Matterbridge Dev Container** with an optimized named volume for `node_modules`.
- [GitHub]: Added GitHub issue templates for bug reports and feature requests.
- [ESLint]: Refactored the flat config.
- [ESLint]: Added the plugins `eslint-plugin-promise`, `eslint-plugin-jsdoc`, and `@vitest/eslint-plugin`.
- [Jest]: Refactored the flat config.
- [Vitest]: Added Vitest for TypeScript project testing. It will replace Jest, which does not work correctly with ESM module mocks.
- [JSDoc]: Added missing JSDoc comments, including `@param` and `@returns` tags.
- [CodeQL]: Added CodeQL badge in the readme.
- [Codecov]: Added Codecov badge in the readme.

### Changed

- [package]: Require matterbridge 3.0.6.
- [package]: Updated package to Automator v. 2.0.1.
- [package]: Updated dependencies.
- [storage]: Bumped `node-storage-manager` to 2.0.0.
- [logger]: Bumped `node-ansi-logger` to 3.1.1.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.2.4] - 2025-06-13

### Added

- [npm]: The dev of matterbridge-example-dynamic-platform is published with tag **dev** on **npm** each day at 00:00 UTC if there is a new commit.

### Changed

- [package]: Require matterbridge 3.0.6.
- [package]: Updated package.
- [package]: Updated dependencies.
- [subscribe]: Prevent attribute setting when context is offline for air purifier and fan.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.2.3] - 2025-05-25

### Added

- [platform]: Added a cover device with both lift and tilt (supported by the Home app).
- [platform]: Added evse (EV charger) device type (not supported by the Home app).

### Changed

- [package]: Require matterbridge 3.0.5.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.2.2] - 2025-05-19

### Added

- [package]: Added waterHeater device type (not supported by Alexa and Apple Home)

### Changed

- [package]: Changed the RVC from local implementation to the new RoboticVacuumCleaner class from matterbridge.
- [package]: Require matterbridge 3.0.3.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.2.1] - 2025-05-15

### Changed

- [package]: Require matterbridge 3.0.1.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.2.0] - 2025-04-30

### Added

- [platform]: Added Robot Vacuum Cleaner device (supported by SmartThings, Alexa, Home Assistant and partially by Apple Home). Read carefully the readme please and also <https://github.com/Luligu/matterbridge/discussions/264>.
- [platform]: Added OnOff Mounted Switch device (supported by SmartThings, Alexa, Home Assistant).
- [platform]: Added Dimmer Mounted Switch device (supported by SmartThings, Alexa, Home Assistant).
- [platform]: Added Laundry Washer device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Laundry Dryer device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Dishwasher device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Refrigerator device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Oven device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Microwave Oven device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Extractor Hood device (supported by SmartThings, Alexa and Home Assistant).
- [platform]: Added Cooktop device (supported by SmartThings, Alexa and Home Assistant).

### Changed

- [package]: Require matterbridge 3.0.0.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.9] - 2025-04-07

### Added

- [platform]: Added select devices for the frontend Devices panel in the home page.
- [config]: Added enableConcentrationMeasurements option to fix the Apple Home issue: Air Quality devices and all SmokeCoAlarm sensors (with or without Smoke and Co) don't show up in the Home app if any of the concentration measurements clusters is present (Carbon Monoxide Concentration Measurements included).
- [platform]: Added smoke only SmokeCoAlarm sensor (supported by Apple Home 18.4).
- [platform]: Added co only SmokeCoAlarm sensor (supported by Apple Home 18.4).

### Changed

- [package]: Require matterbridge 2.2.7.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.8] - 2025-03-05

### Changed

- [package]: Require matterbridge 2.2.0.
- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.7] - 2025-02-11

### Added

- [platform]: Added generic momentary switch device.
- [platform]: Added generic latching switch device.
- [platform]: Added chaining provided by the new MatterbridgeEndpoint api.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.
- [package]: Require matterbridge 2.1.5.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.6] - 2025-02-02

### Changed

- [package]: Require matterbridge 2.1.0.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.4] - 2024-12-21

### Added

- [platform]: Added call to super.OnConfigure() and super.OnShutDown() to check endpoints numbers.

### Changed

- [package]: Updated dependencies.
- [package]: Updated package.

### Fixed

- [thermostat]: Fixed temperature

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.3] - 2024-12-16

### Added

- [package]: Added thermostat Heat only with two external temperature sensors (tagged like Indoor and Outdoor).
- [package]: Added thermostat Cool only.
- [package]: Added an airPurifier device with temperature and humidity sensor (supported by Apple Home).
- [package]: Added a pumpDevice device.
- [package]: Added a waterValve device.

### Changed

- [package]: Require matterbridge 1.6.7.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.2] - 2024-12-12

### Added

- [package]: Added the Matter 1.3 airConditioner device (not supported by Apple Home).
- [package]: Require matterbridge 1.6.6.
- [package]: Added Jest test with 100% coverage.

### Changed

- [package]: Updated package.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.1.0] - 2024-11-25

### Changed

- [package]: Verified to work with matterbridge edge (matter.js new API).
- [package]: Require matterbridge 1.6.2
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.24] - 2024-11-10

### Changed

- [package]: Update to matterbridge edge.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.23] - 2024-10-28

### Changed

- [package]: Upgrade to matterbridge 1.6.0.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.22] - 2024-10-01

### Changed

- [package]: Upgrade to new workflows.
- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.21] - 2024-09-19

### Fixed

- [Dimmer] Fixed command handler

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.20] - 2024-09-08

### Fixed

- [Switch] Fixed command handler

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.19] - 2024-09-04

### Added

- [plugin] Added:
- a light with onOff
- a light with onOff, levelControl
- an air quality device

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

## [1.0.18] - 2024-09-03

### Added

- [plugin] Added:
- a light with onOff, levelControl and colorControl (with HS only) clusters
- a light with onOff, levelControl and colorControl (with XY only) clusters
- a light with onOff, levelControl and colorControl (with CT only) clusters
- a fan with FanControl cluster
- a rainSensor device
- a waterFreezeDetector device
- a waterLeakDetector device
- a smokeCoAlarm device

### Changed

- [package]: Updated dependencies.

<a href="https://www.buymeacoffee.com/luligugithub"><img src="https://matterbridge.io/bmc-button.svg" alt="Buy me a coffee" width="80"></a>

<!-- Commented out section
## [1.1.2] - 2024-03-08

### Added

- [Feature 1]: Description of the feature.
- [Feature 2]: Description of the feature.

### Changed

- [Feature 3]: Description of the change.
- [Feature 4]: Description of the change.

### Deprecated

- [Feature 5]: Description of the deprecation.

### Removed

- [Feature 6]: Description of the removal.

### Fixed

- [Bug 1]: Description of the bug fix.
- [Bug 2]: Description of the bug fix.

### Security

- [Security 1]: Description of the security improvement.
-->
