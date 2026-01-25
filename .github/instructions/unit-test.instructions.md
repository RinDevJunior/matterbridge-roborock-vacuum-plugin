---
description: 'Guidelines for developing unit tests in TypeScript projects.'
applyTo: '**/*.test.ts'
---

# Unit Test Development

> All new and updated unit tests must follow the standard template in `docs/unit_test_template.md`. This ensures consistency and maintainability across the codebase.

## Required Structure

- **Mock Factories:** Always define `createMock...` functions for each dependency or collaborator at the top of the test file.
- **Test Suite:** Use a top-level `describe` block for the class/module under test.
- **Setup/Cleanup:** Use `beforeEach` to set up mocks and the instance under test, and `afterEach` to clean up mocks and timers.
- **Grouping:** Use nested `describe` blocks to group tests by method or feature.
- **Test Cases:** Use `it` blocks for individual test cases, following the Arrange-Act-Assert (AAA) pattern.
- **Refer to Template:** See `docs/unit_test_template.md` for a ready-to-copy example and further guidance.

> These instructions assume projects are built with TypeScript 5.x (or newer) compiling to an ESNext JavaScript baseline. Adjust guidance if your runtime requires older language targets or down-level transpilation.

## Quick Reference Checklist

- Use vitest as the test framework (never jest).
- Place test files in `src/tests` or alongside implementation files, with `.test.ts` suffix.
- Always start with `createMock...` functions for all dependencies.
- Use a top-level `describe` for the class/module, and nested `describe` for methods/features.
- Use `beforeEach` for setup and `afterEach` for cleanup.
- Prefer `const` for variables unless reassignment is required.
- Use Arrange-Act-Assert (AAA) pattern in each test.
- Name tests with clear, behavior-focused descriptions (see below).
- Cover both positive and negative scenarios, including edge cases and error handling.
- Test direct manipulation of exposed internals (e.g., direct map access) if supported by the API.
- Avoid testing implementation details; focus on observable behavior.
- Use type assertions (e.g., `satisfies`) for test data, avoid `as` unless necessary for mocks.
- Never call `expect` inside conditionals.
- Run `npm run lint` and `npm run test` before submitting.
- Reference and follow the structure in `docs/unit_test_template.md`.

## Core Intent

- Ensure tests are reliable, maintainable, and clearly express intent.
- Cover critical paths, edge cases, and error conditions.
- Keep tests isolated, fast, and deterministic.
- Use existing test utilities and patterns established in the codebase.

## Test Organization

- Place test files in `src/tests` or next to the implementation file.
- Name test files with a `.test.ts` suffix (e.g., `userService.test.ts`).
- Use `describe` blocks to group related tests and improve readability.
- Use nested `describe` for sub-features or edge cases.
- Use `beforeEach` for setup and state reset; use `afterEach` if teardown is needed.
- Reuse shared test utilities and static mock factories (e.g., `createMockDevice`).

## Naming & Style

- Use descriptive, behavior-focused names for test cases that clearly state the expected outcome and context.
- Prefer a consistent pattern for test names, such as:
  - `should <expected outcome> when <precondition>` (e.g., `should return cached value when cache entry is fresh`)
  - `returns <value> for <input>` (e.g., `returns empty array for unknown user`)
  - `throws <ErrorType> when <invalid condition>` (e.g., `throws ValidationError when payload is missing id`)
- Use PascalCase for classes, camelCase for functions/variables, matching the main codebase.
- Avoid abbreviations unless widely understood in the context.
- Keep test functions focused; extract helpers for repeated logic or complex setup.

## Formatting & Style

- Run `npm run lint` and `npm run format` before submitting.
- Match the project's indentation, quote style, and trailing comma rules.
- Prefer `const` for variables that do not change and `let` only when reassignment is necessary.
- Use static imports for all dependencies.
- Keep test functions short and focused; extract helpers for repeated or complex logic.

## Test Implementation Expectations

- Do not change implementation code unless fixing a bug; tests should reflect current behavior.
- Do not change production code solely for testability; use dependency injection or mocking if needed.
- Write deterministic tests that always produce the same result.
- Use Arrange-Act-Assert (AAA) pattern in every test.
- Write tests that are independent and can run in any order.
- Use `async/await` for async tests; avoid callbacks.
- Mock external dependencies and side effects for isolation.
- Use assertions that provide clear failure messages.
- Cover both positive and negative scenarios, including edge cases and error handling.
- Test direct manipulation of exposed internals (e.g., direct map access) if the API supports it.
- Avoid testing implementation details; focus on observable behavior.
- Always use static imports.
- If implementation contains interval/timer logic, use timer mocks and clean up after each test.
- Avoid calling `expect` inside conditionals; always assert outside control flow.
- Use type assertions (e.g., `satisfies`) for test data; avoid `as` except for mocks.

## Test Coverage

- Aim for high test coverage, especially for critical and complex code paths.
- Use coverage reports to identify untested areas, but do not chase 100% coverage at the expense of meaningful tests.
- Prioritize tests that add value and confidence in the codebase.
- Explicitly test edge cases, error handling, and overwrites.

## Continuous Integration

- Ensure tests run successfully in the CI environment before merging changes.
- Address any flaky or intermittent tests immediately to maintain CI reliability.

## Architecture & Patterns

- Follow the repository's established testing patterns and architecture.
- Use dependency injection or mocking frameworks as per the project's conventions.
- Keep test modules single-purpose and focused on specific functionality.
- Avoid duplicating test setup logic; use shared utilities, static mock factories, or fixtures.

---

End of Unit Test Instructions.

## Pre commands execution

- Always clean the terminal or console output before running tests to avoid confusion from previous logs.
