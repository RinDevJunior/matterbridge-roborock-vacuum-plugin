Testing guidelines

Purpose

- Provide lightweight, consistent utilities and rules for unit tests in this repo.

Utilities

- Use `src/tests/helpers/testUtils.ts` for shared helpers: `createMockLogger()`, `makeMockClientRouter()`, `makeLocalClientStub()`, `createMockLocalStorage()`, `createMockIotApi()`, `createMockAuthApi()`, and `asPartial<T>()`.
- Prefer these factories over ad-hoc inline mocks; they enforce correct typings and `vi.fn()`-backed async methods where needed.
- Import helpers with a static import and include the `.js` extension in test files: `import { createMockLocalStorage } from './helpers/testUtils.js';

Mocking rules

- Prefer `vi.fn()` or `vi.spyOn()` for all stubs and spies. If a stubbed method is awaited in production code, ensure the mock returns a `Promise` (use `vi.fn().mockResolvedValue()` or pass an async override to a factory).
- Do not use plain functions where you later call `.mockResolvedValue()`; factories expose `vi.fn()` so the `.mock` helpers are always available.
- For cryptographic or network-heavy components, spy the factory method and return a small controlled object (e.g., spy `MessageProcessorFactory.prototype.getMessageProcessor()` and return a fake `decode()` implementation) to avoid invoking real crypto or network.
- Replace network clients with `createMockLocalStorage()`, `makeMockClientRouter()` or `makeLocalClientStub()` helpers rather than large ad-hoc objects.
- **Do not use dynamic `import(...)` in tests**; prefer static imports or the top-level `import type { Type } from 'module'` syntax to avoid runtime side-effects.
- **Avoid `as any` and `as unknown as` in tests.** Use `asPartial<T>(...)`, `Partial<T>`, or small typed fixtures instead.

LocalStorage rules

- Use `createMockLocalStorage()` for `node-persist` LocalStorage mocks. All methods should be async and return `Promise`.
- If you pass synchronous overrides, the factory will wrap them into `Promise`-returning `vi.fn()` for you. This ensures `setItem`, `getItem`, `removeItem`, `clear`, etc. match production signatures.
- When a test expects to check calls or resolve values, use `vi.fn().mockResolvedValue(...)` so you can use `.mock` helpers safely.
  Async & timers

- Use `vi.useFakeTimers()` when testing retry logic or sleep loops; advance timers with `vi.advanceTimersByTime(ms)` and restore with `vi.useRealTimers()`.

Test structure

- Keep tests focused: one logical behavior per `it()`.
- Use small fixtures in `src/tests/exampleData` when binary or JSON payloads are needed.

Running tests

- Run full suite with coverage locally:

```bash
npm run test:coverage --silent
```

Where to add new helpers

- Add new shared helpers to `src/tests/helpers/test-utils.ts` and document usage in this file. For reusable test fixtures (devices, storage, API stubs) add helpers to `src/tests/helpers/fixtures.ts`.

Troubleshooting

- If you see AES/key errors, ensure you're not invoking real `MessageProcessor.decode()` with invalid keys; use a spy to return decrypted payload instead.
- If tests hang on imports, run a single file to reproduce and inspect top-level code that performs network/crypto work.
