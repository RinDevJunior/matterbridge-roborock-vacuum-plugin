# PowerSource Battery Fault Reporting — Deferred Proposal

**Status:** Deferred. Not started — comes back to this after ideas 1 and 3 (ServiceArea ProgressReporting / SelectWhileRunning) land.
**Source:** `docs/apple-home-available-attributes/answer.md` (idea 2 of 3)
**Date noted:** 2026-07-04

## What it is

Add `PowerSource.Feature.Replaceable` plus `batFaultChange`/`batChargeFaultChange` events and populate `activeBatFaults`/`activeBatChargeFaults` attributes, so Apple Home can surface battery fault codes (not just charge percentage/state).

Reference implementation: `matterbridge-dyson-robot`'s `endpoint-360-rvc.ts:35-79` (feature/event wiring) and `endpoint-360.ts:142-168` (populating fault arrays from live device MQTT status).

## Why deferred

Only worth pursuing **if Roborock's device status payload actually carries a battery-fault code**. This needs verification before any implementation — otherwise the attributes would only ever show static/empty data (same failure mode already flagged for the filter-cluster gap in `docs/apple-home-data-status/answer.md`).

## Files likely touched (when picked back up)

- `src/runtimes/handlers/batteryStateHandler.ts` — where battery attributes are currently updated
- `src/initialData/getBatteryStatus.ts` — battery status source data
- Wherever `createDefaultPowerSourceRechargeableBatteryClusterServer` is called (currently inherited from Matterbridge's base `RoboticVacuumCleaner` factory; would need a custom call adding `Replaceable`)

## Next step when resumed

Confirm via `/ref-idea` or direct protocol inspection (python-roborock, real device capture) whether a battery-fault DPS/status code exists in the Roborock protocol. If none exists, this idea should be marked **not viable** rather than implemented with dummy data.
