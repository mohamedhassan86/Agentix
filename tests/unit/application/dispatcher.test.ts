import { describe, it, expect, beforeEach } from "vitest";
import { Dispatcher } from "@/application/shared/dispatch/dispatcher";
import { createRequestContext } from "@/application/shared/context/request-context";

describe("Dispatcher - one-handler dispatch", () => {
  let dispatcher: Dispatcher;

  beforeEach(() => {
    dispatcher = new Dispatcher();
  });

  it("dispatches to registered handler and returns result", async () => {
    const handler = {
      handle: async (req: { type: string; value: number }) => ({ result: req.value * 2 }),
    };
    dispatcher.register("TestQuery", handler as any);

    const ctx = createRequestContext({ correlationId: "0199f000-0000-7000-8000-000000000001" });
    const result = await dispatcher.dispatch({ type: "TestQuery", value: 21 } as any, ctx);
    expect(result).toEqual({ result: 42 });
  });

  it("fails on duplicate registration", () => {
    const handler = { handle: async () => ({}) };
    dispatcher.register("DupQuery", handler as any);
    expect(() => dispatcher.register("DupQuery", handler as any)).toThrow(/already registered/i);
  });

  it("fails on missing handler", async () => {
    const ctx = createRequestContext({ correlationId: "0199f000-0000-7000-8000-000000000002" });
    await expect(dispatcher.dispatch({ type: "MissingQuery" } as any, ctx)).rejects.toThrow(/not registered|not found/i);
  });

  it("propagates AbortSignal to handler", async () => {
    let receivedSignal: AbortSignal | undefined;
    const handler = {
      handle: async (_req: any, ctx: any) => {
        receivedSignal = ctx.signal;
        return {};
      },
    };
    dispatcher.register("SignalQuery", handler as any);
    const controller = new AbortController();
    const ctx = createRequestContext({
      correlationId: "0199f000-0000-7000-8000-000000000003",
      signal: controller.signal,
    });
    await dispatcher.dispatch({ type: "SignalQuery" } as any, ctx);
    expect(receivedSignal).toBe(controller.signal);
  });

  it("aborts when signal is aborted", async () => {
    const handler = {
      handle: async (_req: any, ctx: any) => {
        if (ctx.signal.aborted) throw new Error("aborted");
        return {};
      },
    };
    dispatcher.register("AbortQuery", handler as any);
    const controller = new AbortController();
    controller.abort();
    const ctx = createRequestContext({
      correlationId: "0199f000-0000-7000-8000-000000000004",
      signal: controller.signal,
    });
    await expect(dispatcher.dispatch({ type: "AbortQuery" } as any, ctx)).rejects.toThrow(/aborted/i);
  });
});
