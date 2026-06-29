# Feature Set Investigation

## What are `featureSet` and `newFeatureSet`?

Both are **hex strings** returned verbatim from the Roborock cloud home-data API endpoint as fields on every `Device` record. They encode per-device hardware and firmware capability flags — not user preferences or configuration.

- `featureSet` — decoded as a **64-bit integer**. The lower 32 bits and upper 32 bits are tested separately using bitwise AND.
- `newFeatureSet` — decoded as a **hex string**. Bits are extracted in two ways: by treating the last 8 chars as a 32-bit integer (mask tests), and by nibble-index math for individual bit positions 32–120+.

The Python reference library maps these via `DeviceFeatures.from_feature_flags()` in `roborock/device_features.py`.

---

## What features do they gate?

### featureSet — lower 32 bits (25 flags)

Key examples relevant to a Matter vacuum plugin:

| Feature                                  | Mask       |
| ---------------------------------------- | ---------- |
| `is_carpet_supported`                    | 512        |
| `is_mop_path_supported`                  | 2048       |
| `is_room_name_supported`                 | 16384      |
| `is_shake_mop_set_supported`             | 262144     |
| `is_dust_collection_setting_supported`   | 33554432   |
| `is_avoid_collision_supported`           | 134217728  |
| `is_custom_water_box_distance_supported` | 2147483648 |

### featureSet — upper 32 bits (18 flags)

| Feature                              | Bit index (after >> 32) |
| ------------------------------------ | ----------------------- |
| `is_support_floor_edit`              | 3                       |
| `is_support_furniture`               | 4                       |
| `is_wash_then_charge_cmd_supported`  | 5                       |
| `is_support_room_tag`                | 6                       |
| `is_careful_slow_mop_supported`      | 9                       |
| `is_supported_drying`                | 15                      |
| `is_support_custom_mode_in_cleaning` | 18                      |

### newFeatureSet — last 8 hex chars as 32-bit mask (27 flags)

| Feature                              | Mask       |
| ------------------------------------ | ---------- |
| `is_support_clean_estimate`          | 2          |
| `is_carpet_deep_clean_supported`     | 8          |
| `is_support_stuck_zone`              | 16         |
| `is_clean_route_fast_mode_supported` | 256        |
| `is_back_charge_auto_wash_supported` | 4096       |
| `is_offline_map_supported`           | 16384      |
| `is_support_incremental_map`         | 4194304    |
| `is_clean_count_setting_supported`   | 1073741824 |
| `is_corner_clean_mode_supported`     | 2147483648 |

### newFeatureSet — nibble-index bit extraction (~80 flags)

Individual bits 32–120+ extracted via:

```
charIndexFromEnd = 1 + bitValue / 4   (integer division)
bitInNibble = bitValue % 4
```

Notable bits: `MATTER=67`, `LDS_LIFTING=79`, `AUTO_TEAR_DOWN_MOP=80`, `TWO_KEY_REAL_TIME_VIDEO=32`.

---

## Current plugin state

- `featureSet` and `newFeatureSet` are declared in `src/roborockCommunication/models/device.ts` (lines 38–39) as `string | undefined`.
- They appear in the `Device` DTO which flows through `Home` → `getHome/v2/v3` in `iotClient.ts`.
- **No code in `src/` reads these fields after deserialization.** They are dead fields.
- The only capability gating today is in `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`, which is a static lookup keyed by model string, covering only clean mode availability for 4 models.

---

## How to decode in TypeScript

```typescript
function decodeFeatureSet(featureSet: string, newFeatureSet: string) {
  const featureInt = BigInt(featureSet);                    // or parseInt if value fits 53-bit safe int
  const lower32 = Number(featureInt & 0xFFFFFFFFn);
  const upper32 = Number(featureInt >> 32n);

  const newFeatureInt = parseInt(newFeatureSet.slice(-8), 16); // last 8 hex chars

  return {
    // lower 32 — direct mask tests
    isCarpetSupported:           (lower32 & 512) !== 0,
    isMopPathSupported:          (lower32 & 2048) !== 0,
    isDustCollectionSupported:   (lower32 & 33554432) !== 0,
    // ...

    // upper 32 — bit index tests
    isDryingSupported:           (upper32 & (1 << 15)) !== 0,
    isWashThenChargeSupported:   (upper32 & (1 << 5)) !== 0,
    // ...

    // newFeatureSet mask tests
    isCarpetDeepCleanSupported:  (newFeatureInt & 8) !== 0,
    isCleanCountSupported:       (newFeatureInt & 1073741824) !== 0,
    // ...

    // newFeatureSet nibble-index (example: MATTER = bit 67)
    isMatterSupported: nibbleBit(newFeatureSet, 67),
  };
}

function nibbleBit(hexStr: string, bitValue: number): boolean {
  const charIndexFromEnd = 1 + Math.floor(bitValue / 4);
  const bitInNibble = bitValue % 4;
  const hexChar = hexStr[hexStr.length - charIndexFromEnd] ?? '0';
  const nibble = parseInt(hexChar, 16);
  return (nibble & (1 << bitInNibble)) !== 0;
}
```

One caution: `featureSet` values from real devices can exceed JavaScript's `Number.MAX_SAFE_INTEGER` (2^53 - 1). Use `BigInt` for parsing.

---

## Recommendation

**Use `featureSet`/`newFeatureSet` as a dynamic capability layer on top of the existing static model registry.**

### Short term — high value, low risk

Decode the flags that directly affect what the plugin exposes in Matter:

1. `is_carpet_supported` — gate the carpet mode control
2. `is_mop_path_supported` — gate mop mode options
3. `is_dust_collection_setting_supported` — gate dock dust-collection commands
4. `is_supported_drying` — gate dock drying commands
5. `is_wash_then_charge_cmd_supported` — gate wash-then-charge dock commands
6. `is_carpet_deep_clean_supported` — gate carpet deep-clean option
7. `is_clean_count_setting_supported` — gate repeat-pass count option

These replace the need to add every new model to `deviceCapabilityRegistry.ts` by hand.

### Preferred source at runtime

The Python library's production path reads the same data from `APP_GET_INIT_STATUS` RPC response fields `newFeatureInfo` (integer) and `newFeatureInfoStr` (hex string), not from the home-data `featureSet`/`newFeatureSet`. This RPC is called once at device initialization and the values are semantically identical.

**Action:** Check whether the TypeScript plugin calls `APP_GET_INIT_STATUS` and captures `newFeatureInfo`/`newFeatureInfoStr`. If it does, prefer those. If not, the home-data fields are a reliable fallback and already present in the `Device` DTO with no additional API calls required.

### What NOT to do

- Do not try to gate low-level RPC command details (e.g., `is_rpc_retry_supported`) — these are internal SDK concerns.
- Do not gate map/navigation internals (`is_offline_map_supported`, `is_incremental_map`) — the plugin does not expose those to Matter.
- Do not replace the model-string registry entirely — it may still be needed for quirks not captured in feature flags.
