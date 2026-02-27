import { describe, it, expect, vi } from 'vitest';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { triggerDssError } from '../../runtimes/handleLocalMessage.js';
import { asPartial } from '../helpers/testUtils.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';
import type { AnsiLogger } from 'matterbridge/logger';

const makePlatform = (): RoborockMatterbridgePlatform =>
  asPartial<RoborockMatterbridgePlatform>({
    log: { info: vi.fn(), error: vi.fn(), debug: vi.fn(), warn: vi.fn() } as unknown as AnsiLogger,
  });

const makeRobot = (operationalState: RvcOperationalState.OperationalState): RoborockVacuumCleaner =>
  asPartial<RoborockVacuumCleaner>({
    getAttribute: vi.fn().mockReturnValue(operationalState),
    updateAttribute: vi.fn(),
  });

describe('triggerDssError', () => {
  it('should return true and not update when already in Error state', () => {
    const robot = makeRobot(RvcOperationalState.OperationalState.Error);
    const platform = makePlatform();

    const result = triggerDssError(robot, platform);

    expect(result).toBe(true);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should update to Error and return true when state is Docked', () => {
    const robot = makeRobot(RvcOperationalState.OperationalState.Docked);
    const platform = makePlatform();

    const result = triggerDssError(robot, platform);

    expect(result).toBe(true);
    expect(robot.updateAttribute).toHaveBeenCalledWith(
      RvcOperationalState.Cluster.id,
      'operationalState',
      RvcOperationalState.OperationalState.Error,
      platform.log,
    );
  });

  it('should return false when state is Running', () => {
    const robot = makeRobot(RvcOperationalState.OperationalState.Running);
    const platform = makePlatform();

    const result = triggerDssError(robot, platform);

    expect(result).toBe(false);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should return false when state is SeekingCharger', () => {
    const robot = makeRobot(RvcOperationalState.OperationalState.SeekingCharger);
    const platform = makePlatform();

    const result = triggerDssError(robot, platform);

    expect(result).toBe(false);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });
});
