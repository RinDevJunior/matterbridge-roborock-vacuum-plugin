import { ModeHandler, HandlerContext } from './modeHandler.js';

export class ModeHandlerRegistry {
  private readonly handlers: ModeHandler[] = [];

  public register(handler: ModeHandler): this {
    this.handlers.push(handler);
    return this;
  }

  public async handle(duid: string, mode: number, activity: string, context: HandlerContext): Promise<void> {
    const handler = this.handlers.find((h) => h.canHandle(mode, activity));
    if (handler) {
      await handler.handle(duid, mode, activity, context);
    } else {
      context.logger.notice(`${context.behaviorName}-changeToMode-Unknown: `, mode);
    }
  }
}
