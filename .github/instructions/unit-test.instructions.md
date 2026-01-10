---
description: 'Guidelines for TypeScript Development targeting TypeScript 5.x and ESNext output'
applyTo: '**/*.test.ts'
---

# Unit Test Development

> These instructions assume projects are built with TypeScript 5.x (or newer) compiling to an ESNext JavaScript baseline. Adjust guidance if your runtime requires older language targets or down-level transpilation.

## Core Intent

- Ensure tests are reliable, maintainable, and clearly express intent.
- Cover critical paths, edge cases, and error conditions.
- Keep tests isolated, fast, and deterministic.
- Use existing test utilities and patterns established in the codebase.

## Test Organization

- Place test files alongside implementation files or in a dedicated `src/tests` folder.
- Name test files with a `.test.ts` suffix (e.g., `user-service.test.ts`).
- Group related tests using `describe` blocks to improve readability.
- Use `beforeEach` and `afterEach` hooks for setup and teardown logic.
- Reuse shared test utilities and mocks from the codebase.

## Naming & Style

- Use descriptive, behavior-focused names for test cases that clearly state the expected outcome and context.
- Prefer a consistent pattern for test names, such as:
  - `should <expected outcome> when <precondition>` (e.g., `should return cached value when cache entry is fresh`)
  - `returns <value> for <input>` (e.g., `returns empty array for unknown user`)
  - `throws <ErrorType> when <invalid condition>` (e.g., `throws ValidationError when payload is missing id`)
- Follow the same naming conventions as the main codebase (PascalCase for classes, camelCase for functions/variables).
- Avoid abbreviations unless they are widely understood in the context.

## Formatting & Style

- Run the repository's lint/format scripts (e.g., `npm run lint`) before submitting.
- Match the project's indentation, quote style, and trailing comma rules.
- Keep test functions focused; extract helpers when logic branches grow.
- Prefer `const` for variables that do not change and `let` only when reassignment is necessary.

## Test Implementation Expectations

- Do not change the current implementation code unless fixing a bug; tests should reflect existing behavior.
- Do not change production code solely to make it testable; prefer dependency injection or mocking.
- Write tests that are deterministic and produce the same result every time they run.
- Use Arrange-Act-Assert (AAA) pattern to structure test cases.
- Write tests that are independent and can run in any order.
- Use the testing framework and assertion library established in the project (e.g., Jest, Mocha, Chai).
- Write tests that are easy to read and understand; prioritize clarity over cleverness.
- Use `async/await` for asynchronous tests; avoid mixing with callbacks.
- Mock external dependencies and side effects to ensure test isolation.
- Use assertions that provide clear failure messages.
- Cover both positive and negative scenarios, including edge cases.
- Avoid testing implementation details; focus on observable behavior.

## Test Coverage

- Aim for high test coverage, especially for critical and complex code paths.
- Use coverage reports to identify untested areas, but do not chase 100% coverage at the expense of meaningful tests.
- Prioritize tests that add value and confidence in the codebase.

## Continuous Integration

- Ensure tests run successfully in the CI environment before merging changes.
- Address any flaky tests or intermittent failures to maintain CI reliability.

## Architecture & Patterns

- Follow the repository's established testing patterns and architecture.
- Use dependency injection or mocking frameworks as per the project's conventions.
- Keep test modules single-purpose and focused on specific functionality.
- Avoid duplicating test setup logic; use shared utilities or fixtures.
