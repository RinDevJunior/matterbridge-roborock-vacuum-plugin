# To Do

Completed items have been archived to `workspace/to_do_archive.md`. This file tracks active pending work only.

## Recently done

- [x] **Cleanups, sender log, CLI consumable command, two bug fixes (PR #187, d79e2e7)** — WP1–WP3 done
- [x] **Release-comments on merged PRs (PR #186, 5ea859c)** — `announce-release` job; release PRs skipped; first real proof on rc08
- [x] **Release 1.2.0-rc07 (07e3a80)** — includes selectAreas fix #184
- [x] **Clean check on rc07 (2026-10-18 08:00)** — full four-room cycle completed; selectAreas accepted in 33 ms
- [x] **Wiki constants-reference note** — done with WP1
- [x] **selectAreas hang fix (PR #184, b7adbed)**
- [x] **Release 1.2.0-rc05 and 1.2.0-rc06** — published as prereleases + Discord

## Pending

- [ ] **Release 1.2.0-rc08 when user asks** — then verify release comments on #184, #185, #186, #187
- [ ] **Real-device check of rc07 over several days** — beyond the single 2026-10-18 clean; watch for stuck transactions
- [ ] **PR #165 (dev to main, 1.2.0 release PR)** — still open
- [ ] **Older issues #107, #80, #69, #63, #42** — unchanged
- [ ] **Q10 RvcOperationalState badge follow-up (issue #166 residual)** — Q10 raw 101/103 can still show "Error" on the Matter RvcOperationalState badge; may need stateResolver.ts or function.ts
- [ ] **V1 legacy room fallback real-device validation** — currentArea updates via V1 fallback during real clean (cleaning_info absent from status pushes)
- [ ] **V1 zone/wall coordinate-unit real-device validation** — confirm mapParser blocks 9/10/12 use raw mm on a device with virtual walls/no-go zones
- [ ] **buildCleanCommand room collapse investigation (Bug B)** — app_start sent without room list when "all rooms" selected
- [ ] **Q10 S5+ battery reading investigation (postponed 2026-07-11)** — see `workspace/investigate-battery-capacity-q10/answer.md`; open: 10+ min debug log spanning a battery change, confirm `refreshInterval` and local vs MQTT-only mode, ask whether restart un-sticks the value
- [ ] **ChangeToMode(Mapping) support** — deferred; no dispatcher command across V1-protocol devices
- [ ] **B01/Q10 currentArea real-device validation** — multi-room cleaning tracks the room correctly
- [ ] **RVC estimatedEndTime real-device validation** — V1/B01/Q10 `clean_percent` tracks progress with `enableEstimatedEndTime`
- [ ] **RVC SkipArea real-device validation** — expect success on V10, `InvalidInMode` on B01/Q7
- [ ] **Live-device: full multi-room clean** — Completed/Skipped stay after docking; next Start shows Pending (PR #175/#176)
- [ ] **Live-device: pause→resume** — progress preserved across pause/resume
- [ ] **Live-device: skip rooms (PR #174 native API)** — skip current and non-active rooms
- [ ] **Real-device test of selectAreas fix with restart (PR #184)** — scheduled Apple Home clean after Matterbridge restart; confirm no stuck transaction
- [ ] **Persisted cleaning run state (PR #181, `enablePersistCleaningState` default OFF)** — needs real-robot test before enabling by default
- [ ] **Known limitation: Idle-code status between Start and first active status** — can clear Pending seed
- [ ] **Known limitation: mid-run recharge resume and plugin restart mid-run** — decide whether to persist/restore
- [ ] **Status line command path is relative** — `.claude/settings*.json` breaks if cwd leaves repo root
- [ ] **Dead code: `DeviceConfigurator.configureDevice`** — never returns false
- [ ] **Optional CLI tests batch 10** — `src/cli` untested; excluded from coverage thresholds
- [ ] **.claude/memory.md over cap** — Common Pitfalls and Test Patterns exceed 10-bullet limit; archive to wiki/memory-archive.md
- [ ] **RVC FillingWaterTank real-device validation** — `wash_status` / `replenish_mode` disambiguation on dock-fill robots
- [ ] **RVC SelectWhileRunning (idea 2, deferred)** — change selected areas while running
- [ ] **B01/Q10 Apple Home icon validation** — room category icons on real device (IDs 2001–2011)
- [ ] **External room list R2 (deferred per user)** — deterministic `"Room {id}"` fallback in `getSupportedAreas.ts`
- [ ] **Q7 upload_by_maptype hardware validation** — R1 map fetch on real Q7
- [ ] **B01 currentPose Phase 2 (deferred)** — `roomMatrix` pixel-to-room decode once Q10 wire layout confirmed
- [ ] **Legacy map hex fixture** — optional A187 `"rr"` binary fixture from live run
- [ ] **Startup room name real-device validation** — real names (not "Room 1"–"Room 4") on V10 after restart
- [ ] **MapInfoListener room name enrichment (deferred)** — apply `enrichMapRoomDtoFromMapInfo` on push path if needed
- [ ] **Deferred: log noise redundant writes** — architect plan in `workspace/log-noise-redundant-writes/`; not implemented (decision 2026-10-18)

### Open Feature Gaps

- [ ] **Gap 3** — Firmware-version-aware device capability selection (low, complex; could leverage featureSetDecoder)
- [ ] **Gap 4** — `roomNames` config override for manual room name assignment (low, ready to implement when user reports)
