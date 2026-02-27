import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RvcOperationalState } from 'matterbridge/matter/clusters';
import { triggerDssError } from '../../runtimes/handleLocalMessage.js';
import { createMockLogger, asPartial } from '../helpers/testUtils.js';
import type { RoborockVacuumCleaner } from '../../types/roborockVacuumCleaner.js';
import type { RoborockMatterbridgePlatform } from '../../module.js';

function createMockRobot(operationalState: RvcOperationalState.OperationalState): RoborockVacuumCleaner {
  return asPartial<RoborockVacuumCleaner>({
    getAttribute: vi.fn().mockReturnValue(operationalState),
    updateAttribute: vi.fn(),
  });
}

function createMockPlatform(): RoborockMatterbridgePlatform {
  return asPartial<RoborockMatterbridgePlatform>({
    log: createMockLogger(),
  });
}

describe('triggerDssError', () => {
  let platform: RoborockMatterbridgePlatform;

  beforeEach(() => {
    vi.clearAllMocks();
    platform = createMockPlatform();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return true and not update when already in Error state', () => {
    const robot = createMockRobot(RvcOperationalState.OperationalState.Error);

    const result = triggerDssError(robot, platform);

    expect(result).toBe(true);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should update to Error and return true when state is Docked', () => {
    const robot = createMockRobot(RvcOperationalState.OperationalState.Docked);

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
    const robot = createMockRobot(RvcOperationalState.OperationalState.Running);

    const result = triggerDssError(robot, platform);

    expect(result).toBe(false);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });

  it('should return false when state is SeekingCharger', () => {
    const robot = createMockRobot(RvcOperationalState.OperationalState.SeekingCharger);

    const result = triggerDssError(robot, platform);

    expect(result).toBe(false);
    expect(robot.updateAttribute).not.toHaveBeenCalled();
  });
});
