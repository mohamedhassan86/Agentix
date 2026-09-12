import type { RequestContext } from "../context/request-context";
import { NotFoundError } from "../errors/app-error";
import { ErrorCodes } from "../errors/error-codes";

export interface Handler<TReq = unknown, TRes = unknown> {
  handle(request: TReq, context: RequestContext): Promise<TRes>;
}

export interface Dispatchable {
  type: string;
}

export class Dispatcher {
  private handlers = new Map<string, Handler>();

  register<TReq extends Dispatchable, TRes>(type: string, handler: Handler<TReq, TRes>): void {
    if (this.handlers.has(type)) {
      throw new Error(`Handler already registered for type: ${type}`);
    }
    this.handlers.set(type, handler as Handler);
  }

  async dispatch<TReq extends Dispatchable, TRes>(request: TReq, context: RequestContext): Promise<TRes> {
    const type = (request as any).type;
    if (!type) {
      throw new NotFoundError(`Request type missing`, ErrorCodes.WORK_HANDLER_NOT_REGISTERED);
    }
    const handler = this.handlers.get(type);
    if (!handler) {
      throw new NotFoundError(`Handler not registered for type: ${type}`, ErrorCodes.WORK_HANDLER_NOT_REGISTERED);
    }
    if (context.signal.aborted) {
      throw new Error("aborted");
    }
    return (await handler.handle(request, context)) as TRes;
  }

  hasHandler(type: string): boolean {
    return this.handlers.has(type);
  }

  clear(): void {
    this.handlers.clear();
  }
}
