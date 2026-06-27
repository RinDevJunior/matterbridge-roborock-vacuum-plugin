## Task

Wire `decodeFeatureSet` from `src/share/featureSetDecoder.ts` into the capability registry so that device feature support is determined dynamically from `featureSet`/`newFeatureSet` flags instead of (or alongside) the static model-name lookup in `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`.

## Questions

### Q1

What does `deviceCapabilityRegistry.ts` export? List every exported symbol (functions, constants, types/interfaces). For each exported function show its signature and return type. Show what the static lookup table looks like (key type, value type, example entries).
Relevant area: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts`

### Q2

What interface or type does the registry return to callers — is there a `DeviceCapabilities` type, or is it an inline object shape, or something else? Provide the full type definition including every property and its type.
Relevant area: `src/behaviors/roborock.vacuum/core/deviceCapabilityRegistry.ts` and any type files it imports

### Q3

Which files import from `deviceCapabilityRegistry.ts`? For each callsite: show the import statement, the call expression, how the result is stored, and what downstream behavior is gated on each property of the result.
Relevant area: search all of `src/` for imports of `deviceCapabilityRegistry`

### Q4

What is the full interface/type of `DeviceFeatures` as exported from `src/share/featureSetDecoder.ts`? List every property name and type. Then map each property to the capability flag(s) in the registry return type (Q2) that it could replace or extend — note any gaps where the registry returns a capability that `DeviceFeatures` has no equivalent for, or vice versa.
Relevant area: `src/share/featureSetDecoder.ts`

### Q5

Where is the capability registry called — what is the exact call site? Is the model name string passed in, and where does that string come from? Is the `Device` DTO (with `featureSet` and `newFeatureSet` fields) available at the same call site, or would it need to be threaded in?
Relevant area: wherever `getDeviceCapabilities` (or whatever the registry function is named) is called

### Q6

What is the domain entity that represents a device inside the behavior layer? Does it carry `featureSet` and `newFeatureSet` fields, or does it only expose the model name? Show the full type/class definition (properties only — skip method bodies).
Relevant area: `src/behaviors/roborock.vacuum/core/` or `src/core/` — look for a DeviceEntity, DeviceModel, or similar class

### Q7

How does the `Device` DTO from `src/roborockCommunication/models/device.ts` flow from the home-data API response into the behavior layer? Trace the path: API response → parsing → storage → retrieval at the capability registry call site. Show the relevant function names, class names, and whether `featureSet`/`newFeatureSet` are preserved at each step.
Relevant area: `src/roborockCommunication/`, `src/services/`, `src/behaviors/roborock.vacuum/core/`

### Q8

Are there any capabilities currently returned by the static registry that have no corresponding `DeviceFeatures` flag (i.e., they are truly model-name-only)? List them explicitly so the plan can decide whether to keep a hybrid (static for those, dynamic for others) or always fall back to static when featureSet is absent.
Relevant area: `deviceCapabilityRegistry.ts` registry table and `featureSetDecoder.ts` `DeviceFeatures` interface

## Status

pending
