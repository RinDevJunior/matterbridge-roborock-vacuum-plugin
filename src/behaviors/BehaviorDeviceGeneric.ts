import { Behavior, MaybePromise } from 'matterbridge/matter';
import { AnsiLogger } from 'node-ansi-logger';

export type DeviceCommandHandler = (...args: any[]) => MaybePromise;

export interface DeviceCommands {
  [command: string]: DeviceCommandHandler;
}

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

export class BehaviorGeneric<StateType extends {}> extends Behavior {
  static override readonly id: string;
  declare state: StateType;
}

export class BehaviorRoborock extends Behavior {
  static override readonly id = 'roborock.vacuum.axx';
  declare state: BehaviorRoborock.State;
}
export namespace BehaviorRoborock {
  export class State {
    device!: BehaviorDeviceGeneric<DeviceCommands>;
  }
}
