Testing guidelines

Purpose

- Provide lightweight, consistent utilities and rules for unit tests in this repo.

Utilities

- Use `src/tests/testUtils.ts` for `makeLogger()`, `makeMockClientRouter()` and `makeLocalClientStub()`.
- Import only the helpers you need: `import { makeLogger } from './testUtils';`

Mocking rules

- Prefer `vi.spyOn()` or `vi.fn()` to stub behavior; avoid module-level mocks that invoke heavy crypto.
- For message processor decoding, spy the factory method (`MessageProcessorFactory.prototype.getMessageProcessor`) and return a controlled object with `decode()` to avoid real AES calls.
- Replace network clients with small stubs from `testUtils.makeMockClientRouter()` or `makeLocalClientStub()`.

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

- Add new shared helpers to `src/tests/testUtils.ts` and document usage in this file.

Troubleshooting

- If you see AES/key errors, ensure you're not invoking real `MessageProcessor.decode()` with invalid keys; use a spy to return decrypted payload instead.
- If tests hang on imports, run a single file to reproduce and inspect top-level code that performs network/crypto work.
