import { AnsiLogger } from 'matterbridge/logger';
import { Behavior, MaybePromise } from 'matterbridge/matter';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type DeviceCommandHandler = (...args: any[]) => MaybePromise;

export type DeviceCommands = Record<string, DeviceCommandHandler>;

export class BehaviorDeviceGeneric<Commands extends DeviceCommands> {
  readonly commands: Partial<Commands> = {};
  constructor(readonly log: AnsiLogger) {}

  setCommandHandler<Command extends keyof Commands>(command: Command, handler: Commands[Command]): void {
    if (this.commands[command]) throw new Error(`Handler already registered for command ${String(command)}`);
    this.commands[command] = handler;
  }

  async executeCommand<Command extends keyof Commands>(command: Command, ...args: Parameters<Commands[Command]>): Promise<void> {
    const handler = this.commands[command];
    if (!handler) throw new Error(`${String(command)} not implemented`);
    await (handler as DeviceCommandHandler)(...args);
  }
}

export class BehaviorRoborock extends Behavior {
  static override readonly id = 'roborock.vacuum.axx';
  declare state: BehaviorRoborockState;
}
export interface BehaviorRoborockState {
  device: BehaviorDeviceGeneric<DeviceCommands>;
}
