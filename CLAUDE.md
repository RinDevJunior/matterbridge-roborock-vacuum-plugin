# Matterbridge Roborock Vacuum Plugin

Project-specific instructions for Claude Code.

## Claude Response Expection

- Be concise. No explanations unless I ask.
- Output code only. No prose.
- No yapping, no long explanations.
- Provide details only when explicitly asked.
- Update `docs\claude_history.md` to track execution process.
- Update `docs\to_do.md` what plan to do and what completed.

## Task Classification

Before making any code changes, classify the user request as one of:

- **Unit test** - Follow the Unit Test Development section
- **Logic/feature** - Follow the TypeScript Development section
- **Release note** - Follow the Release Guidelines section

Never mix logic and test changes in a single step—split them and follow the relevant section.

If the task type is unclear, ask for clarification before proceeding.

## Coding Standards

- Remove unused variables, functions, and imports to keep the code clean.
- If something must remain unused, rename it to an underscore `_` to indicate intentional non-use.

## Troubleshooting

- After running `npm install`, run `npm run build:local` to resolve potential build issues.

---

# TypeScript Development

> These instructions assume projects are built with TypeScript 5.x (or newer) compiling to an ESNext JavaScript baseline.

## Core Intent

- Respect the existing architecture and coding standards.
- Prefer readable, explicit solutions over clever shortcuts.
- Extend current abstractions before inventing new ones.
- Prioritize maintainability and clarity, short methods and classes, clean code.

## General Guardrails

- Target TypeScript 5.x / ESNext and prefer native features over polyfills.
- Use pure ES modules; never emit `require`, `module.exports`, or CommonJS helpers.
- Rely on the project's build, lint, and test scripts unless asked otherwise.
- Note design trade-offs when intent is not obvious.

## Project Organization

- Follow the repository's folder and responsibility layout for new code.
- Use camelCase filenames (e.g., `userSession.ts`, `dataService.ts`) unless told otherwise.
- Keep tests, types, and helpers near their implementation when it aids discovery.
- Reuse or extend shared utilities before adding new ones.
- Test files must be located in `src/test` or alongside implementation files as per project conventions.
- Read the project's structure from `docs/CODE_STRUCTURE.md` to understand module boundaries and responsibilities.

## Coding Practices

- Apply TDD: write tests before implementation when feasible for fixes or features.
- Favor composition over inheritance; use interfaces and types for contracts.
- Add `public`, `private`, or `protected` access modifiers explicitly.
- Use `readonly` for properties that should not change after initialization.
- Prefer `const` and `let` over `var`; use `const` by default.
- Destructure objects and arrays to extract needed values.
- Use template literals for string interpolation and multi-line strings.
- Leverage modern ESNext features like optional chaining, nullish coalescing, and top-level await.
- Avoid deep nesting by early returns or guard clauses.
- Use `for...of` loops or array methods (`map`, `filter`, `reduce`) instead of traditional `for` loops when iterating collections.
- Handle asynchronous code with `async/await` instead of raw Promises when possible.
- Use `try/catch` blocks around `await` calls that may fail.
- Prefer `Map`, `Set`, and other built-in data structures over plain objects for collections when appropriate.
- Avoid using `eval`, `with`, or other dynamic code features.
- Keep functions focused on a single task; extract helpers for complex logic.

## Naming & Style

- Use PascalCase for classes, interfaces, enums, and type aliases; camelCase for everything else.
- Skip interface prefixes like `I`; rely on descriptive names.
- Name things for their behavior or domain meaning, not implementation.

## Formatting & Style

- Run the repository's lint/format scripts (e.g., `npm run lint`) before submitting.
- Match the project's indentation, quote style, and trailing comma rules.
- Keep functions focused; extract helpers when logic branches grow.
- Favor immutable data and pure functions when practical.

## Type System Expectations

- Avoid `any` (implicit or explicit); prefer `unknown` plus narrowing.
- Use discriminated unions for realtime events and state machines.
- Centralize shared contracts instead of duplicating shapes.
- Express intent with TypeScript utility types (e.g., `Readonly`, `Partial`, `Record`).

## Async, Events & Error Handling

- Use `async/await`; wrap awaits in try/catch with structured errors.
- Guard edge cases early to avoid deep nesting.
- Send errors through the project's logging/telemetry utilities.
- Surface user-facing errors via the repository's notification pattern.
- Debounce configuration-driven updates and dispose resources deterministically.

## Architecture & Patterns

- Follow the repository's dependency injection or composition pattern; keep modules single-purpose.
- Observe existing initialization and disposal sequences when wiring into lifecycles.
- Keep transport, domain, and presentation layers decoupled with clear interfaces.
- Supply lifecycle hooks (e.g., `initialize`, `dispose`) and targeted tests when adding services.

## External Integrations

- Instantiate clients outside hot paths and inject them for testability.
- Never hardcode secrets; load them from secure sources.
- Apply retries, backoff, and cancellation to network or IO calls.
- Normalize external responses and map errors to domain shapes.

## Security Practices

- Validate and sanitize external input with schema validators or type guards.
- Avoid dynamic code execution and untrusted template rendering.
- Encode untrusted content before rendering HTML; use framework escaping or trusted types.
- Use parameterized queries or prepared statements to block injection.
- Keep secrets in secure storage, rotate them regularly, and request least-privilege scopes.
- Favor immutable flows and defensive copies for sensitive data.
- Use vetted crypto libraries only.
- Patch dependencies promptly and monitor advisories.

## Configuration & Secrets

- Reach configuration through shared helpers and validate with schemas or dedicated validators.
- Handle secrets via the project's secure storage; guard `undefined` and error states.
- Document new configuration keys and update related tests.

## UI & UX Components

- Sanitize user or external content before rendering.
- Keep UI layers thin; push heavy logic to services or state managers.
- Use messaging or events to decouple UI from business logic.

## Performance & Reliability

- Lazy-load heavy dependencies and dispose them when done.
- Defer expensive work until users need it.
- Batch or debounce high-frequency events to reduce thrash.
- Track resource lifetimes to prevent leaks.

## Documentation & Comments

- Write comments that capture intent, and remove stale notes during refactors.
- Update architecture or design docs when introducing significant patterns.

---

# Unit Test Development

> These instructions assume projects are built with TypeScript 5.x (or newer) compiling to an ESNext JavaScript baseline.

## Core Intent

- Ensure tests are reliable, maintainable, and clearly express intent.
- Cover critical paths, edge cases, and error conditions.
- Keep tests isolated, fast, and deterministic.
- Use existing test utilities and patterns established in the codebase.

## Test Organization

- Place test files alongside implementation files or in a dedicated `src/tests` folder.
- Name test files with a `.test.ts` suffix (e.g., `userService.test.ts`).
- Group related tests using `describe` blocks to improve readability.
- Use `beforeEach` and `afterEach` hooks for setup and teardown logic.
- Reuse shared test utilities and mocks from the codebase.

## Naming & Style

- Use descriptive, behavior-focused names for test cases that clearly state the expected outcome and context.
- Prefer a consistent pattern for test names:
  - `should <expected outcome> when <precondition>` (e.g., `should return cached value when cache entry is fresh`)
  - `returns <value> for <input>` (e.g., `returns empty array for unknown user`)
  - `throws <ErrorType> when <invalid condition>` (e.g., `throws ValidationError when payload is missing id`)
- Follow the same naming conventions as the main codebase (PascalCase for classes, camelCase for functions/variables).
- Avoid abbreviations unless they are widely understood in the context.

## Test Implementation

- Do not change the current implementation code unless fixing a bug; tests should reflect existing behavior.
- Do not change production code solely to make it testable; prefer dependency injection or mocking.
- Write tests that are deterministic and produce the same result every time they run.
- Use Arrange-Act-Assert (AAA) pattern to structure test cases.
- Write tests that are independent and can run in any order.
- **Use vitest as the test framework (do not use jest).**
- Write tests that are easy to read and understand; prioritize clarity over cleverness.
- Use `async/await` for asynchronous tests; avoid mixing with callbacks.
- Mock external dependencies and side effects to ensure test isolation.
- Use assertions that provide clear failure messages.
- Cover both positive and negative scenarios, including edge cases.
- Avoid testing implementation details; focus on observable behavior.
- Always use static imports.
- If implementation contains interval/timer logic, use timer mocks to control time in tests.
- Clean up interval/timer mocks after each test to prevent side effects.
- Test files must be located in `src/test` or alongside implementation files as per project conventions.
- Avoid calling `expect` inside conditional statements (move assertions outside `if/else`).
- Use type assertions (e.g., `satisfies`) to ensure test data conforms to expected types. Avoid using `as` for type casting.

## Test Coverage

- Aim for high test coverage, especially for critical and complex code paths.
- Use coverage reports to identify untested areas, but do not chase 100% coverage at the expense of meaningful tests.
- Prioritize tests that add value and confidence in the codebase.

## Continuous Integration

- Ensure tests run successfully in the CI environment before merging changes.
- Address any flaky tests or intermittent failures to maintain CI reliability.

## Pre-commands Execution

- Always clean the terminal or console output before running tests to avoid confusion from previous logs.

---

# Release Guidelines

Follow these steps to ensure a consistent and reliable release process:

## 1. Versioning Consistency

- Update the `version` property in `package.json`.
  - Check the current version and increment the `rc` version.
  - Use the format `x.x.x-rcyy` (e.g., `1.1.1-rc01`).
  - `x.x.x` is the major version.
  - `-rc` stands for release candidate.
  - `yy` is the candidate version.
- Update the `buildpackage` command in `package.json` so the `.tgz` filename matches the new version (e.g., `matterbridge-roborock-vacuum-plugin-1.1.2.tgz`).

## 2. Documentation Updates

- In `README.md`, update the `Requires matterbridge@xxx` line to match the `precondition` version in `package.json`.

## 3. Schema and Config Synchronization

- Update the `version` in the `description` field of `matterbridge-roborock-vacuum-plugin.schema.json` to the new version.
- Update the `version` in `matterbridge-roborock-vacuum-plugin.config.json` to the new version.

## 4. Source Code Alignment

- In `src/module.ts`, set the `requiredMatterbridgeVersion` to match the required `matterbridge` version specified in the `precondition` field of `package.json`.

## 5. General Best Practices

- Double-check all version references for consistency before release.

---

# Testing Expectations

- Rerun unit tests and linters before and after changes.
- If there are no tests, add new unit tests to cover your changes.
- Add or update unit tests with the project's framework and naming style.
- Expand integration or end-to-end suites when behavior crosses modules or platform APIs.
- Run targeted test scripts for quick feedback before submitting.
- Avoid brittle timing assertions; prefer fake timers or injected clocks.
