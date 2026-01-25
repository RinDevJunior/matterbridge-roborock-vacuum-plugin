# Unit Test Template (TypeScript, Vitest)

This template provides a standard structure for writing unit tests in this project, based on best practices and the conventions used in `platformLifecycle.test.ts`.

---

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import the module(s) under test and any required types
// import { MyClass } from '../path/to/MyClass';
// import type { MyType } from '../path/to/types';

// --- Mock Factories ---
function createMockDependency(): /* Type */ any {
  return {
    // stubbed methods and properties
    method: vi.fn(),
    // ...
  };
}

function createMockOther(): /* Type */ any {
  return {
    // stubbed methods and properties
  };
}

// --- Test Suite ---
describe('MyClass', () => {
  let mockDep: ReturnType<typeof createMockDependency>;
  let mockOther: ReturnType<typeof createMockOther>;
  let instance: any; // Replace with actual type

  beforeEach(() => {
    // Set up mocks and instance before each test
    mockDep = createMockDependency();
    mockOther = createMockOther();
    // instance = new MyClass(mockDep, mockOther);
  });

  afterEach(() => {
    // Clean up mocks, timers, etc.
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('someMethod', () => {
    it('should do something expected', async () => {
      // Arrange
      // ...
      // Act
      // await instance.someMethod();
      // Assert
      // expect(...).toBe(...);
    });

    // Add more tests for edge cases, errors, etc.
  });

  // Add more describe blocks for other methods/features
});
```

---

## Template Usage Guidelines

- Always define `createMock...` functions for each dependency or collaborator.
- Use `describe` blocks to group tests by method or feature.
- Use `beforeEach` to set up mocks and the instance under test.
- Use `afterEach` to clean up mocks and timers.
- Prefer `const` for variables unless reassignment is required.
- Use `vi.fn()` for mocking functions.
- Cover both positive and negative scenarios, including edge cases and error handling.
- Use Arrange-Act-Assert (AAA) pattern in each test.
- Use clear, behavior-focused test names.
- Run `npm run lint` and `npm run test` before submitting.
