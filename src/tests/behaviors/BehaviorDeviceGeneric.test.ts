import { describe, it, expect, vi } from 'vitest';
import { BehaviorDeviceGeneric } from '../../behaviors/BehaviorDeviceGeneric.js';

describe('BehaviorDeviceGeneric', () => {
  it('registers and executes a command handler', async () => {
    const log: any = { error: vi.fn(), debug: vi.fn(), notice: vi.fn() };
    const b = new BehaviorDeviceGeneric<any>(log);

    const handler = vi.fn(async (x: number) => x + 1);
    b.setCommandHandler('inc' as any, handler as any);

    await b.executeCommand('inc' as any, 2);
    expect(handler).toHaveBeenCalledWith(2);
  });

  it('throws when registering duplicate handler', () => {
    const log: any = { error: vi.fn(), debug: vi.fn(), notice: vi.fn() };
    const b = new BehaviorDeviceGeneric<any>(log);
    const h = vi.fn();
    b.setCommandHandler('cmd', h as any);
    expect(() => b.setCommandHandler('cmd', h as any)).toThrow();
  });

  it('throws when executing unregistered command', async () => {
    const log: any = { error: vi.fn(), debug: vi.fn(), notice: vi.fn() };
    const b = new BehaviorDeviceGeneric<any>(log);
    await expect(b.executeCommand('nope' as any)).rejects.toThrow();
  });
});
