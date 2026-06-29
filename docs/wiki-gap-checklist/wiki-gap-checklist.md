# Wiki Gap Checklist

Actionable backlog for closing documentation gaps between the wiki submodule and the codebase.

**Baseline:** ~251 production `.ts` files under `src/`. Current wiki covers main runtime flows well (~80–85%) but not every module.

**Last reviewed:** 2026-06-29

---

## Priority legend

| Priority | Meaning |
|----------|---------|
| **P0** | Runtime behavior undocumented or misleading — likely to mislead contributors |
| **P1** | Important reference material missing — slows onboarding/debugging |
| **P2** | Nice-to-have depth, consolidation, or cross-linking |
| **P3** | Maintenance / housekeeping (stale refs, broken links) |

---

## P0 — New pages or major expansions

| # | Proposed page | Why | Key sources | Suggested sections |
|---|---------------|-----|-------------|-------------------|
| 1 | **B01 Map Parsing** | `roborockCommunication/map/b01/` is used in production (`mapInfoListener` → `B01MapParser`) but has **zero** wiki coverage | `map/b01/b01MapParser.ts`, `roborockProto.ts`, `types.ts`, `mapInfoListener.ts` | Overview; encrypted binary → decrypt → inflate → protobuf; key derivation (`modelShortCode` + serial); output shape (`B01MapInfo`, `B01RoomInfo`); when V1 vs B01 path is chosen; link to [Room-Map-Data-Pipeline](Room-Map-Data-Pipeline) |
| 2 | **Home Data Sync Runtime** | `updateFromHomeData` is summarized in [Status-Update-Flow](Status-Update-Flow) (~10 lines) but full sync logic is not | `runtimes/handleHomeDataMessage.ts`, `platformRunner.ts` (`requestHomeData`) | Field-by-field sync (battery, state, error, suction, water, charge); schema merge from `homeData.products`; stale/real-time skip rules; interaction with burst polling and watchdog; diagram vs push listeners |
| 3 | **Protocol Builders & Serializers** | Dispatchers have a full page; outbound encoding (builders + serializers) is table-only | `protocol/builders/*`, `protocol/serializers/*`, `messageBodyBuilderFactory.ts`, `messageSerializerFactory.ts` | Factory selection by protocol version; builder → serializer pipeline; per-protocol differences (L01/A01/B01/V01); link to [Roborock-Protocol-Wire-Format](Roborock-Protocol-Wire-Format) and [Device-Command-Execution](Device-Command-Execution) |
| 4 | **Types & Message Contracts** | `types/` is the contract layer between listeners, runtimes, and handlers — no reference page | `types/MessagePayloads.ts`, `notifyMessageTypes.ts`, `roborockVacuumCleaner.ts`, `state.ts`, `communication.ts`, `factories.ts`, `callbacks.ts` | `NotifyMessageTypes` enum; `MessagePayload` discriminated union; `RoborockVacuumCleaner` shape; who produces/consumes each type; link to [Runtime-Handlers-Pipeline](Runtime-Handlers-Pipeline) and [Message-Listeners-Architecture](Message-Listeners-Architecture) |

---

## P1 — New reference pages

| # | Proposed page | Why | Key sources | Suggested sections |
|---|---------------|-----|-------------|-------------------|
| 5 | **Error Class Hierarchy** | [Error-Handling-Reporting](Error-Handling-Reporting) covers runtime mapping; `errors/` taxonomy is Code-Structure-only | `errors/*.ts`, `model/VacuumStatus.ts`, `model/DockStationStatus.ts` | `BaseError` contract; auth/comms/config/device/validation subclasses; when thrown vs when mapped to Matter `ErrorState`; link to `misc/vacuum_error_code_mapping.md` |
| 6 | **Constants Reference** | Timeouts, thresholds, and IDs are scattered — no single lookup | `constants/*.ts`, `settings.ts` | `timeouts.ts`, `battery.ts`, `device.ts`, `ids.ts`, `distance.ts`; `sensitiveDataRegexReplacements.ts`; `settings.ts` (plugin name, version, engine constraints) |
| 7 | **Plugin Model Layer** | `src/model/` vs `core/application/models/` vs `roborockCommunication/models/` boundary is confusing | `model/*.ts`, `core/application/models/*`, Refactoring Priority 3 | What lives where and why; `CleanCommand`, `CloudMessageModel`, `RoborockPluginPlatformConfig`; migration rule |
| 8 | **Communication Helpers** | Crypto/sequence/chunk utilities are used on the wire path but barely documented | `helper/cryptoHelper.ts`, `chunkBuffer.ts`, `sequence.ts`, `nameDecoder.ts`, `B01VacuumModeResolver.ts` | Each helper's role; call sites; link to protocol and clean-mode pages |
| 9 | **Message Routing Handlers** | Listeners are documented; outbound `routing/handlers/` is not | `routing/handlers/abstractMessageHandler.ts`, `implementation/simpleMessageHandler.ts`, `messageProcessor.ts` | Inbound deserialize → processor → listener fan-out; handler registration; consolidate `OneShotResponseListener` with listeners page |
| 10 | **Behavior Handler Reference** | Six handlers exist; only aggregate behavior is described | `handlers/*.ts`, `core/modeHandler.ts`, `modeHandlerRegistry.ts`, `behaviorConfig.ts` | Per-handler: trigger, Matter cluster, `RoborockService` call; handler chain order |
| 11 | **Supported Devices & Adding Models** | Lives in `README_SUPPORTED.md` + `README_DEV.md`, not wiki | `models/deviceModel.ts`, `deviceCapabilityRegistry.ts`, `README_DEV.md`, `README_SUPPORTED.md` | Tested vs unsupported table; how to add a model; link to [Clean-Mode-Domain](Clean-Mode-Domain) and [Feature-Flags](Feature-Flags-Device-Capabilities) |
| 12 | **Testing Guide** | Test strategy is a summary in Code-Structure only | `src/tests/testing-guidelines.md`, `vite.config.ts`, test folder layout | How to run tests/coverage; mock patterns (`testData/`); what each `tests/` subtree covers |

---

## P1 — Expand existing pages

| Page | Gap | What to add |
|------|-----|-------------|
| [Supporting-Domains](Supporting-Domains) | Incomplete utility coverage | `dependency-check.ts`, `runtimeHelper.ts`, `function.ts`, `helper.ts`, `behaviorFactory.ts` |
| [Authentication-Flow](Authentication-Flow) | Thin on persistence layer | `AuthContext`, `AuthenticationStateRepository`, `UserDataRepository`, token refresh, persist storage keys |
| [MQTT-Local-Communication](MQTT-Local-Communication) | `messageProcessor` inbound path shallow | Full inbound lifecycle: raw frame → deserializer → processor → broadcaster → listener |
| [Clean-Mode-Domain](Clean-Mode-Domain) | `cleanModeConfig/` split not reflected | Update for directory module; `modeResolver.ts` resolution order |
| [Configuration-Domain](Configuration-Domain) | Schema file under-documented | `matterbridge-roborock-vacuum-plugin.schema.json` field reference |
| [Code-Structure](Code-Structure) | Catch-all is stale in places | See P3 fixes; trim duplication with domain pages |

---

## P2 — Integrate external docs into wiki

| # | External source | Action | Target wiki page |
|---|-----------------|--------|------------------|
| 13 | `misc/state_resolution_matrix.md` | Merge or link as canonical reference | Expand [Supporting-Domains](Supporting-Domains) or new **State Resolution Matrix** page |
| 14 | `misc/vacuum_error_code_mapping.md` | Merge lookup tables | [Error-Handling-Reporting](Error-Handling-Reporting) or new error reference page |
| 15 | `misc/status.md` | Review and absorb if still accurate | [Status-Update-Flow](Status-Update-Flow) |
| 16 | `README_CLI.md` | Cross-link or absorb unique content | [CLI-Tool-Domain](CLI-Tool-Domain) |
| 17 | `README_CLEANMODE.md` | Cross-link or absorb | [Clean-Mode-Domain](Clean-Mode-Domain) |
| 18 | `troubleshoot/STUCK_AT_UPDATING_ISSUE.md` | User-facing troubleshooting | New **Troubleshooting** page |
| 19 | `README_REPORT_ISSUE.md` | Issue reporting workflow | New **Contributing / Report Issue** stub on wiki Home |

---

## P3 — Stale or incorrect content to fix

| # | File | Issue | Fix | Status |
|---|------|-------|-----|--------|
| 20 | [Refactoring-Recommendations](Refactoring-Recommendations) | Priority 1 marked as proposal; already implemented | Mark **done**; update remaining priorities | Done |
| 21 | [Email-Notification-Plan](Email-Notification-Plan) | Reads as plan; code exists | Renamed to [Email-Notifications](Email-Notifications) (implemented) | Done |
| 22 | [Code-Structure](Code-Structure) | `platformConfig.ts` | → `platformConfigManager.ts` | Done |
| 23 | [Code-Structure](Code-Structure) | `cleanModeConfig.ts` single file | → `cleanModeConfig/` directory | Done |
| 24 | [Code-Structure](Code-Structure) | Links to `migration.md`, `to_do.md`, `authentication-flow.md` | Remove broken links or add pages | Done |
| 25 | [Code-Structure](Code-Structure) | Test count / version dates inconsistent | Align with `package.json` / test tree | Done |
| 26 | [README_DEV.md](../README_DEV.md) | Still references `cleanModeConfig.ts` | Update to `cleanModeConfig/` | Done |
| 27 | [Home.md](Home.md) | Missing index for planned pages; stale email link | Update index | Done |

---

## P3 — `Home.md` index additions (after pages exist)

```markdown
## Reference (proposed new section)

| Page | Description |
|------|-------------|
| B01 Map Parsing | Protobuf map decode for B01 protocol devices |
| Home Data Sync Runtime | Cloud polling fallback via updateFromHomeData |
| Protocol Builders & Serializers | Outbound message encoding per protocol version |
| Types & Message Contracts | NotifyMessageTypes, MessagePayload, shared interfaces |
| Error Class Hierarchy | Typed errors vs Matter operational errors |
| Constants Reference | Timeouts, thresholds, plugin metadata |
| Plugin Model Layer | src/model vs core vs communication models |
| Supported Devices | Tested models and how to add new ones |
| Testing Guide | Vitest layout, mocks, conventions |
| Troubleshooting | Known issues (e.g. stuck at updating) |
```

---

## Intentionally out of scope

| Area | Reason |
|------|--------|
| `vite.config.ts`, `eslint.config.js`, CI workflows | Build/tooling — keep in README_DEV or `.github/` |
| `screenshot/`, `logo.png` | Assets only |
| Every file under `tests/` individually | Covered by Testing Guide |
| `misc/sample_data/` | Test fixtures |

---

## Suggested implementation order

1. **Quick wins** — P3 items 20–27 (stale fixes)
2. **Highest runtime risk** — P0 items 1–2 (B01 map, home data sync)
3. **Contributor friction** — P0–4, P1 items 5–7, 11–12 (types, errors, constants, devices, testing)
4. **Consolidation** — P2 items 13–19 (absorb `misc/` and READMEs)

---

## Coverage target

| After completing… | Approx. coverage |
|-------------------|------------------|
| Current wiki | ~80–85% of meaningful runtime code |
| P0 + P3 fixes | ~90% |
| P0 + P1 + P3 | ~95% |
| Full checklist | ~98% (excluding build/CI/assets) |
