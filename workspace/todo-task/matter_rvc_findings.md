# Matter Protocol: Architectural Breakdown of RVC Clusters & Progress Reporting

This document summarizes the technical findings regarding the **Robotic Vacuum Cleaner (RVC)** device type (`0x0074`) within the Matter Protocol specification (v1.2 through v1.4), its implementation frameworks (`connectedhomeip`, `matter.js`, `Matterbridge`), and structural strategies for mapping proprietary telemetry (e.g., `python-roborock`) to Matter standard attributes.

---

## 1. Comprehensive RVC Cluster Architecture & Feature Maps

Matter structures complex appliances using a modular, template-driven approach. Two core RVC clusters are derived from the **Mode Base Cluster**, while the operational lifecycle relies on the **Operational State Base Cluster**.

### 1.1 RVC Run Mode Cluster (`0x0054`)

Manages high-level system operating states (e.g., Idle, Cleaning, Mapping).

- **Feature Map Bits:**
  - **`DEPONOFF` (Dependent On/Off | Bit 0):** Establishes a structural dependency with the _On/Off Cluster_ (`0x0006`). Turning the vacuum "Off" forces a transition to an idle/docked state, while turning it "On" kicks off a default cleaning pattern.
  - **`DIRECTMODECH` (Direct Mode Change | Bit 20):** Declares that the hardware can jump between active running states (e.g., switching from _Cleaning_ directly to _Mapping_) without being forced to step through an intermediate _Idle_ sequence.

### 1.2 RVC Clean Mode Cluster (`0x0055`)

Manages localized cleaning sub-configurations (e.g., Suction Power, Mopping Intensity, Fluid Flow Rates).

- **Feature Map Bits:**
  - **`DEPONOFF` (Dependent On/Off | Bit 0):** Binds sub-modes to the structural power toggle.
  - **`DIRECTMODECH` (Direct Mode Change | Bit 20):** Allows standard controllers to dynamically alter operational intensities (e.g., shifting from _Quiet_ to _Max Vacuum_ mode) mid-cycle while the hardware is actively in motion.

### 1.3 RVC Operational State Cluster (`0x0061`)

Tracks physical component state machines and safety flags (e.g., Running, Paused, Seeking Charger, Charging, Error).

- **Feature Map Bits:**
  - **None (Bitmask `0x00`):** The operational base template enforces mandatory logic, state arrays (`OperationalStateList`), and standardized error-reporting telemetry hooks out-of-the-box rather than relying on optional feature flags.

### 1.4 Service Area Cluster (`0x0150`)

Introduced in **Matter 1.4** to move past whole-home cleaning limitations by exposing spatial layouts, map layers, and targeted zone navigation.

- **Feature Map Bits:**
  - **`SELRUN` (Select While Running | Bit 0):** Permits dynamic modifications to the active room queue while a cycle is in progress.
  - **`PROG` (Progress Reporting | Bit 1):** Unlocks deep session tracking, dynamic duration estimations, and queue order visibility.
  - **`MAPS` (Maps | Bit 2):** Declares compliance for structural multi-map layer tracking, allowing ecosystems to fetch geometric room representations.

---

## 2. Core Implementation Status

### 2.1 `project-chip/connectedhomeip` (Official Matter SDK)

- **Status:** Fully Supported.
- **Architecture:** RVC capabilities were integrated for the Matter 1.4 spec push. The SDK implements standard template generation via ZAP (`rvc-run-mode-cluster.xml`).
- **Reference Testing:** Automated python validation blueprints (`src/python_testing/TC_RVCRUNM_2_1.py`) verify `DIRECTMODECH` compliance by executing mock cross-state jumps during active certification loops.

### 2.2 `Matterbridge` & `matter.js`

- **Status:** Fully Supported (v3.0+ frameworks mapping to `matter.js` v0.13+ engines).
- **Implementation Note:** While the underlying engine fully supports the structures, advanced custom features (like room selection or precise multi-map hooks) are frequently instantiated via `MutableCluster` objects by plugin developers to bypass core framework lag and map complex local payloads safely.

---

## 3. Deep Dive: Progress Reporting (`PROG`)

Activating **Bit 1 (`PROG`)** in the Service Area Cluster shifts a vacuum from an unmonitored "black box" into an interactive, context-aware peripheral. It exposes four fundamental attributes:

1. **`ProgressList` (Array):** Ordered structural list of targeted Area IDs scheduled for the active cleaning session.
2. **`CurrentArea` (uint32):** The specific structural Area ID the vacuum is actively operating inside at the present timestamp.
3. **`EstimatedCompletionTime` (uint32):** Total calculated seconds remaining before the entire session queue completes.
4. **`EstimatedAreaCompletionTime` (uint32):** Total calculated seconds remaining before the current specific room is completed.

---

## 4. Synthesizing Time Remaining from Closed APIs (`python-roborock`)

Because cloud-connected vacuums (like Roborock) do not provide direct mathematical fields for time remaining in their telemetry (`get_status`), the data must be computed analytically using raw status parameters and historical performance data.

### 4.1 Global Session Duration Estimation (`EstimatedCompletionTime`)

To establish a realistic total remaining time, your integration must monitor real-time cleaning speed against historical profiles.

- **Symptom / Telemetry Sourced:**
  - `status.clean_area`: Square meters cleaned in the current run.
  - `status.clean_time`: Elapsed seconds in the current run.
  - `get_clean_summary()`: Lifetime summary stats (`total_area` / `total_time`).
- **Derivation Formula:**
  1. Determine the efficiency coefficient (R):
     R = clean_area / clean_time [Fallback to: total_area / total_time if session just started]
  2. Compute total area remainder (Delta_A):
     Delta_A = A_target_total - clean_area
  3. Calculate the remaining duration:
     T_remaining = Delta_A / R

### 4.2 Room-Specific Duration Estimation (`EstimatedAreaCompletionTime`)

Per-room countdown tracking can be handled through historical execution lookups mapped to localized state machine transitions.

- **Symptom / Telemetry Sourced:**
  - `get_clean_sequence()`: Array tracking the ordered route of target Room IDs.
  - `get_clean_record()`: Historical log database containing exact duration metrics for individual room segments across past operations.
  - Map Parsing Streams (`02 01` coordinate vectors or segment boundary triggers): Sourced to observe exactly when the hardware crosses a threshold into a new localized segment.
- **Derivation Algorithm:**
  1. Catch the threshold transition event indicating a change in room ID.
  2. Query `get_clean_record()` to compute the historical average duration (T_room_avg) for that newly active Room ID.
  3. Instantiate a localized high-resolution monotonic stopwatch timer (t_elapsed) at the moment of entry.
  4. Constantly update the Matter attribute using:
     T_room_remaining = Math.max(0, T_room_avg - t_elapsed)

---

## 5. Blueprint Implementation Reference

The following TypeScript code block illustrates how to build a wrapper class within a custom Matterbridge plugin environment to support `DirectModeChange` and implement live progress estimations.

```typescript
import {
    MatterbridgeDevice,
    ClusterServer,
    InteractionStatusCode
} from 'matterbridge';
import { RvcRunModeCluster, RvcRunMode, ServiceAreaCluster, ServiceArea } from '@matter/main/clusters';

export class AdvancedMatterVacuum extends MatterbridgeDevice {
    private localRobotApi: any; // e.g., Python-wrapped or direct local Miio/Roborock API connection
    private roomStartTime: number | null = null;
    private activeRoomAvgDuration: number = 900; // Default fallback: 15 minutes

    constructor(plugin: any, api: any) {
        super(plugin, { deviceType: 0x0074 }); // Robotic Vacuum Cleaner Node Type
        this.localRobotApi = api;
    }

    public async initializeAdvancedClusters() {
        // --- 1. RUN MODE CLUSTER WITH DIRECTMODECHANGE ---
        const rvcRunModeWithDirectChange = RvcRunModeCluster.withFeatures(
            RvcRunMode.Feature.DirectModeChange
        );

        this.addClusterServer(
            ClusterServer(
                rvcRunModeWithDirectChange,
                {
                    supportedModes: [
                        { label: "Idle", mode: 0, semanticTags: [{ value: RvcRunMode.ModeTag.Idle }] },
                        { label: "Cleaning", mode: 1, semanticTags: [{ value: RvcRunMode.ModeTag.Cleaning }] },
                        { label: "Mapping", mode: 2, semanticTags: [{ value: RvcRunMode.ModeTag.Mapping }] }
                    ],
                    currentMode: 0,
                },
                {
                    changeToMode: async ({ request, attributes }) => {
                        const targetMode = request.newMode;
                        this.log.info(`Direct Mode Change triggered to state: ${targetMode}`);
                        try {
                            if (targetMode === 1) {
                                await this.localRobotApi.startCleaning({ overrideCurrentState: true });
                            } else if (targetMode === 2) {
                                await this.localRobotApi.startMapping({ overrideCurrentState: true });
                            } else {
                                await this.localRobotApi.stopAndDock();
                            }
                            attributes.currentMode.set(targetMode);
                            return { status: InteractionStatusCode.Success };
                        } catch (err) {
                            return { status: InteractionStatusCode.Failure, statusText: "Hardware rejected state jump." };
                        }
                    }
                }
            )
        );

        // --- 2. SERVICE AREA CLUSTER WITH PROGRESS REPORTING ---
        const serviceAreaWithProgress = ServiceAreaCluster.withFeatures(
            ServiceArea.Feature.Maps,
            ServiceArea.Feature.ProgressReporting
        );

        this.addClusterServer(
            ClusterServer(
                serviceAreaWithProgress,
                {
                    supportedAreas: [], // Populated dynamically from map geometry profiles
                    selectedAreas: [],
                    currentArea: null,
                    progressList: [],
                    estimatedCompletionTime: 0,
                    estimatedAreaCompletionTime: 0
                },
                {}
            )
        );
    }

    /**
     * Telemetry parsing loop executing whenever a new data payload arrives from python-roborock
     */
    public handleTelemetryUpdate(status: { clean_time: number, clean_area: number }, history: { total_time: number, total_area: number }) {
        const serviceAreaServer = this.getClusterServer(ServiceAreaCluster);
        if (!serviceAreaServer) return;

        // Calculate cleaning velocity (m^2 per second)
        let rate = status.clean_time > 0 ? (status.clean_area / status.clean_time) : 0;
        if (rate === 0 && history.total_time > 0) {
            rate = history.total_area / history.total_time; // Fallback to lifetime velocity profile
        }

        if (rate > 0) {
            const totalTargetArea = this.calculateTotalTargetAreaMeters();
            const remainingArea = Math.max(0, totalTargetArea - status.clean_area);
            const totalSecondsRemaining = Math.round(remainingArea / rate);

            // Push calculation straight into the Matter fabric
            serviceAreaServer.setEstimatedCompletionTimeAttribute(totalSecondsRemaining);
        }

        // Handle localized room countdown metrics
        if (this.roomStartTime) {
            const elapsedInRoom = (Date.now() - this.roomStartTime) / 1000;
            const roomSecondsRemaining = Math.max(0, Math.round(this.activeRoomAvgDuration - elapsedInRoom));
            serviceAreaServer.setEstimatedAreaCompletionTimeAttribute(roomSecondsRemaining);
        }
    }

    /**
     * Intercept event indicating that the vacuum's coordinate or segment tracing matches a new room boundary
     */
    public handleRoomTransition(newRoomId: number, historicalRecords: any[]) {
        this.roomStartTime = Date.now();

        // Extract room-specific performance averages from clean history records
        const matchingRecord = historicalRecords.find(r => r.roomId === newRoomId);
        this.activeRoomAvgDuration = matchingRecord ? matchingRecord.avgDurationSeconds : 900;

        const serviceAreaServer = this.getClusterServer(ServiceAreaCluster);
        if (serviceAreaServer) {
            serviceAreaServer.setCurrentAreaAttribute(newRoomId);
        }
    }

    private calculateTotalTargetAreaMeters(): number {
        // Concrete plugin mapping logic translating selected room layouts to an aggregate m^2 baseline
        return 45.0;
    }
}
```
