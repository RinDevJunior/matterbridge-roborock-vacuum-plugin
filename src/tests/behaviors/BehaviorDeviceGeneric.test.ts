import { describe, it, expect, vi } from 'vitest';
import { BehaviorDeviceGeneric, DeviceCommands } from '../../behaviors/BehaviorDeviceGeneric.js';
import { createMockLogger } from '../helpers/testUtils.js';

describe('BehaviorDeviceGeneric', () => {
  it('registers and executes a command handler', async () => {
    const log = createMockLogger();
    type TestCommands = DeviceCommands & {
      inc: (x: number) => Promise<number>;
    };
    const b = new BehaviorDeviceGeneric<TestCommands>(log);

    const handler: TestCommands['inc'] = vi.fn(async (x: number) => x + 1);
    b.setCommandHandler('inc', handler);

    await b.executeCommand('inc', 2);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('throws when registering duplicate handler', () => {
    const log = createMockLogger();
    type SomeCommands = DeviceCommands & Record<string, (...args: unknown[]) => unknown>;
    const b = new BehaviorDeviceGeneric<SomeCommands>(log);
    const h: SomeCommands[string] = vi.fn();
    b.setCommandHandler('cmd', h);
    expect(() => {
      b.setCommandHandler('cmd', h);
    }).toThrow();
  });

  it('throws when executing unregistered command', async () => {
    const log = createMockLogger();
    type AnyCommands = DeviceCommands & Record<string, (...args: unknown[]) => Promise<unknown>>;
    const b = new BehaviorDeviceGeneric<AnyCommands>(log);
    await expect(b.executeCommand('nope')).rejects.toThrow();
  });
});
