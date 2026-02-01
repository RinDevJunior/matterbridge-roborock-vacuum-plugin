# Unit Test Template (TypeScript, Vitest)

This template provides a standard structure for writing unit tests in this project, based on best practices and the conventions used in `platformLifecycle.test.ts`.

---

## Basic Template

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockLogger, asPartial, asType, setReadOnlyProperty } from '../helpers/testUtils.js';
// Import the module(s) under test and any required types
// import { MyClass } from '../../path/to/MyClass.js';
// import type { MyType } from '../../path/to/types.js';

// --- Mock Factories ---
function createMockDependency(): Dependency {
  return {
    method: vi.fn(),
    asyncMethod: vi.fn().mockResolvedValue('result'),
    property: 'value',
  };
}

function createMockClientRouter(): ClientRouter {
  return {
    registerMessageListener: vi.fn(),
    registerDevice: vi.fn(),
    connect: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
  } as Partial<ClientRouter> as ClientRouter;
}

// --- Test Suite ---
describe('MyClass', () => {
  let mockLogger: ReturnType<typeof createMockLogger>;
  let mockDep: ReturnType<typeof createMockDependency>;
  let mockRouter: ReturnType<typeof createMockClientRouter>;
  let instance: MyClass;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    mockDep = createMockDependency();
    mockRouter = createMockClientRouter();
    instance = new MyClass(mockDep, mockLogger);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Only if your tests use timers:
    // vi.clearAllTimers();
    // vi.useRealTimers();
  });

  describe('someMethod', () => {
    it('should return expected result when called with valid input', async () => {
      // Arrange
      const input = asPartial<InputType>({ id: '123', name: 'test' });
      mockDep.asyncMethod.mockResolvedValue('success');

      // Act
      const result = await instance.someMethod(input);

      // Assert
      expect(result).toBe('success');
      expect(mockDep.asyncMethod).toHaveBeenCalledWith(input);
    });

    it('should throw error when input is invalid', async () => {
      // Arrange
      const invalidInput = asPartial<InputType>({ id: '' });

      // Act & Assert
      await expect(instance.someMethod(invalidInput)).rejects.toThrow(/Invalid input/);
    });
  });

  describe('methodWithCallback', () => {
    it('should register callback and invoke it correctly', () => {
      // Arrange
      let capturedCallback: ((data: DataType) => void) | undefined;
      vi.mocked(mockRouter.registerMessageListener).mockImplementation((cb) => {
        capturedCallback = cb;
      });

      // Act
      instance.initialize(mockRouter);

      // Assert
      expect(mockRouter.registerMessageListener).toHaveBeenCalled();
      expect(capturedCallback).toBeDefined();

      const testData = asPartial<DataType>({ value: 'test' });
      capturedCallback!(testData);
      // Assert callback behavior...
    });
  });

  describe('methodWithSpy', () => {
    it('should call internal method with correct parameters', () => {
      // Arrange - spy on private method using bracket notation
      const spy = vi.spyOn(instance['privateMethod']).mockReturnValue('mocked');

      // Act
      const result = instance.publicMethod('input');

      // Assert
      expect(spy).toHaveBeenCalledWith('input');
      expect(result).toBe('mocked');
    });

    it('should access private property using bracket notation', () => {
      // Arrange - set private property
      instance['privateProperty'] = 'test-value';

      // Act
      const result = instance['getPrivateProperty']();

      // Assert
      expect(result).toBe('test-value');
    });

    it('should set readonly property using setReadOnlyProperty', () => {
      // Arrange - set readonly private property
      setReadOnlyProperty(instance, 'readonlyProperty', 'readonly-value');

      // Act
      const result = instance.getReadonlyProperty();

      // Assert
      expect(result).toBe('readonly-value');
    });
  });

  describe('methodAccessingMockCalls', () => {
    it('should verify listener was registered with correct configuration', () => {
      // Arrange & Act
      instance.setupListener(mockRouter);

      // Assert - accessing mock calls on typed object
      const calls = vi.mocked(mockRouter.registerMessageListener).mock.calls;
      expect(calls).toHaveLength(1);
      const listener = calls[0][0];
      expect(listener).toHaveProperty('onMessage');
    });
  });
});
```

---

## Advanced Examples

### Testing with Partial Objects

```ts
it('should handle partial device data', () => {
  const partialDevice = asPartial<Device>({
    duid: 'test-123',
    name: 'Test Device',
    // Other properties will be undefined but type-safe
  });

  const result = instance.processDevice(partialDevice);
  expect(result).toBeDefined();
});
```

### Testing Axios Mocks

```ts
import type { AxiosStatic, AxiosInstance } from 'axios';

it('should make API call with correct parameters', async () => {
  const mockAxios = asPartial<AxiosStatic>({
    post: (async (..._args: any[]) => ({
      data: { success: true, data: { token: 'abc123' } },
    })) as any,
  });

  const result = await instance.authenticate(mockAxios);
  expect(result.token).toBe('abc123');
});
```

### Testing with Timers

```ts
it('should debounce repeated calls', async () => {
  vi.useFakeTimers();

  instance.debouncedMethod('call1');
  instance.debouncedMethod('call2');
  instance.debouncedMethod('call3');

  // Fast-forward time
  await vi.advanceTimersByTimeAsync(1000);

  expect(mockDep.method).toHaveBeenCalledTimes(1);
  expect(mockDep.method).toHaveBeenCalledWith('call3');

  vi.useRealTimers();
});
```

### Testing Error Conditions

```ts
it('should handle network errors gracefully', async () => {
  mockDep.asyncMethod.mockRejectedValue(new Error('Network timeout'));

  await expect(instance.fetchData()).rejects.toThrow(/Network timeout/);
  expect(mockLogger.error).toHaveBeenCalled();
});

it('should throw specific error when validation fails', () => {
  expect(() => instance.validate(null)).toThrow(/Cannot validate null/);
});
```

---

## Template Usage Guidelines

### Structure & Organization

- Always define `createMock...` functions for each dependency or collaborator
- Use `describe` blocks to group tests by method or feature
- Use `beforeEach` to set up mocks and the instance under test
- Use `afterEach` to clean up mocks (and timers only if needed)
- Place test files in `src/tests/` or alongside implementation files

### Typing & Type Safety

- **NEVER use `any` type** - use proper types or `Partial<Type>`
- Use `asPartial<T>({})` for partial object initialization (from `testUtils.ts`)
- Use `asType<T>(object)` for type casting (from `testUtils.ts`)
- Use `createMockLogger()` for logger mocks (from `testUtils.ts`)
- Use `setReadOnlyProperty()` for setting readonly properties in tests (from `testUtils.ts`)
- Type mock factory return values explicitly (e.g., `createMockDep(): Dependency`)
- Use `ReturnType<typeof factory>` for inferring mock types

### Mocking Best Practices

- Use `vi.fn()` for all mock functions
- Use `vi.fn().mockResolvedValue()` for async methods
- Use `vi.fn().mockRejectedValue()` for async errors
- Use `vi.spyOn()` to spy on existing methods
- Use `vi.mocked()` to access mock properties on typed objects:
  ```ts
  const calls = vi.mocked(mockRouter.registerMessageListener).mock.calls;
  ```
- Access private methods/properties using bracket notation (NEVER use `as any`):
  ```ts
  instance['privateMethod']();          // Call private method
  instance['privateProperty'] = value;  // Set private property
  expect(instance['privateProperty']).toBe(value);  // Assert private property
  ```
- Use `setReadOnlyProperty()` for readonly properties:
  ```ts
  setReadOnlyProperty(instance, 'readonlyProperty', 'value');  // Set readonly property
  ```

### Testing Patterns

- Use Arrange-Act-Assert (AAA) pattern in each test
- Use clear, behavior-focused test names (e.g., `should return cached value when cache entry is fresh`)
- Cover both positive and negative scenarios, including edge cases and error handling
- Test error conditions with `expect().rejects.toThrow()` or `expect(() => ...).toThrow()`
- Capture callbacks using `mockImplementation`:
  ```ts
  let captured: Callback;
  vi.mocked(mock.register).mockImplementation((cb) => { captured = cb; });
  ```

### Async & Timers

- Use `async/await` for asynchronous tests
- Use `vi.useFakeTimers()` / `vi.useRealTimers()` for timer-dependent code
- Use `vi.advanceTimersByTimeAsync()` to advance fake timers
- Always clean up timers in `afterEach` if used

### Critical Rules

- **NEVER use dynamic `import(...)`** - use static imports only
- **NEVER use `as any` or `as unknown as`** - use type helpers or bracket notation instead
- **ALWAYS use bracket notation for private members**: `instance['privateMethod']()`, not `(instance as any).privateMethod()`
- Always use `.js` extension in import paths
- Run `npm run lint` and `npm run test` before committing
- Clean up mocks with `vi.clearAllMocks()` in `beforeEach` or `afterEach`
