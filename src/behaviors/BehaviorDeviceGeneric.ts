import { AnsiLogger } from 'matterbridge/logger';
import { Behavior, MaybePromise } from 'matterbridge/matter';

// Command names as constants to avoid typos and improve maintainability
// Shared across all device types (default, type1, type2, etc.)
export const CommandNames = {
  IDENTIFY: 'identify',
  SELECT_AREAS: 'selectAreas',
  CHANGE_TO_MODE: 'changeToMode',
  PAUSE: 'pause',
  RESUME: 'resume',
  GO_HOME: 'goHome',
  STOP: 'stop',
} as const;

export interface DeviceEndpointCommands extends DeviceCommands {
  selectAreas: (newAreas: number[]) => MaybePromise;
  changeToMode: (newMode: number) => MaybePromise;
  pause: () => MaybePromise;
  resume: () => MaybePromise;
  goHome: () => MaybePromise;
  identify: (identifyTime: number) => MaybePromise;
  stop: () => MaybePromise;
}

export type DeviceCommandHandler = (...args: never[]) => MaybePromise;

export type DeviceCommands = Record<string, DeviceCommandHandler>;

export class BehaviorDeviceGeneric<Commands extends DeviceCommands> {
  readonly commands: Partial<Commands> = {};
  constructor(readonly log: AnsiLogger) {}

  setCommandHandler<Command extends keyof Commands>(command: Command, handler: Commands[Command]): void {
    if (this.commands[command]) throw new Error(`Handler already registered for command ${String(command)}`);
    this.commands[command] = handler;
  }

  async executeCommand<Command extends keyof Commands>(
    command: Command,
    ...args: Parameters<Commands[Command]>
  ): Promise<void> {
    const handler = this.commands[command];
    if (!handler) throw new Error(`${String(command)} not implemented`);
    await handler(...args);
  }
}

export class BehaviorRoborock extends Behavior {
  static override readonly id = 'roborock.vacuum.axx';
  declare state: BehaviorRoborockState;
}

export interface BehaviorRoborockState {
  device: BehaviorDeviceGeneric<DeviceCommands>;
}
