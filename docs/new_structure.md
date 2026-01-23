# Project — Post-Migration Structure

This document shows the projected repository layout after completing the migration phases in docs/migration.md.

```
src/
├─ module.ts
├─ platform/
│  ├─ platformLifecycle.ts
│  ├─ deviceRegistry.ts
│  ├─ platformConfig.ts
│  └─ platformState.ts
├─ roborockCommunication/
│  ├─ api/
│  │  ├─ authClient.ts
│  │  └─ iotClient.ts
│  ├─ mqtt/
│  │  ├─ mqttClient.ts
│  │  └─ messageProcessor.ts
│  ├─ local/
│  │  ├─ localClient.ts
│  │  └─ udpClient.ts
│  ├─ protocol/
│  │  ├─ serializers/
│  │  │  └─ (serializer files...)
│  │  ├─ builders/
│  │  │  └─ (builder files...)
│  │  └─ deserializers/
│  │     └─ (deserializer files...)
│  ├─ routing/
│  │  ├─ clientRouter.ts
│  │  ├─ abstractClient.ts
│  │  └─ listeners/
│  │     └─ (listener files...)
│  ├─ models/
│  │  └─ (files copied from Zmodel/)
│  └─ enums/
│     └─ (files copied from Zenum/)
├─ core/
│  ├─ domain/
│  │  ├─ entities/
│  │  │  ├─ Device.ts
│  │  │  ├─ Home.ts
│  │  │  └─ Room.ts
│  │  └─ value-objects/
│  │     ├─ DeviceId.ts
│  │     └─ CleanMode.ts
│  └─ ports/
│     ├─ IDeviceGateway.ts
│     ├─ IAuthGateway.ts
│     └─ IMessageBroker.ts
├─ roborockService.ts
├─ roborockVacuumCleaner.ts
├─ behaviorFactory.ts
├─ filterLogger.ts
├─ helper.ts
├─ settings.ts
├─ runtimes/
├─ services/
├─ behaviors/
└─ tests/

docs/
├─ migration.md
├─ new_structure.md
└─ CODE_STRUCTURE.md

exampleData/

package.json
tsconfig.json
tsconfig.base.json
tsconfig.production.json
tsconfig.vitest.json
vite.config.ts
README.md
README_DEV.md
README_SUPPORTED.md
LICENSE
CHANGELOG.md
```

Notes

- `Zmodel/` and `Zenum/` remain in place during Phase 1; `models/` and `enums/` are additive copies until Phase 2 cleanup.
- Do NOT use barrel `index.ts` files. Use explicit file-level imports and exports (for example: `import { Device } from './models/device.js').
- Platform modules live under `src/platform` and `module.ts` becomes a thin facade delegating to them.
- Communication layer is reorganized under `src/roborockCommunication` with subfolders for `api`, `mqtt`, `local`, `protocol`, and `routing`.

Verification checklist

- [ ] `src/roborockCommunication/models` exists and mirrors `Zmodel` content
- [ ] `src/roborockCommunication/enums` exists and mirrors `Zenum` content
- [ ] `npm run build` passes after Phase 1
- [ ] `npm run test` passes after Phase 1
- [ ] `src/module.ts` reduced to a thin facade after Phase 2
- [ ] All imports updated to explicit file paths (no barrel imports) during Phase 2
