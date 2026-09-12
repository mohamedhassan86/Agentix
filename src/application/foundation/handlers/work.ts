import type { RequestContext } from "@/application/shared/context/request-context";
import type { CreateFoundationWorkCommand } from "../commands/work";
import type { GetFoundationWorkQuery } from "../queries/work";
import type { FoundationWorkResponse } from "../dto/work";
import { NotFoundError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import { v7 as uuidv7 } from "uuid";
import { globalWork } from "@/application/shared/work/work-envelope";
import { FOUNDATION_DEMO_WORK_TYPE, FOUNDATION_DEMO_SCHEMA_VERSION } from "../constants";
import type { IFoundationDemoRepository } from "@/application/shared/ports/foundation-demo-repository";
import type { IConfig } from "@/application/shared/ports/config";

export interface FoundationWorkHandlerDeps {
  demoRepository: IFoundationDemoRepository;
  config: IConfig;
}

export function createFoundationWorkHandler(deps: FoundationWorkHandlerDeps) {
  return async (command: CreateFoundationWorkCommand, ctx: RequestContext): Promise<{ response: FoundationWorkResponse; isNew: boolean }> => {
    const { demoRepository, config } = deps;

    if (config.app.env === "production" && !config.foundation.demoEnabled) {
      throw new NotFoundError("Foundation work not found", ErrorCodes.NOT_FOUND);
    }

    const idempotencyKey = command.idempotencyKey ?? uuidv7();
    const requestId = uuidv7();
    const workId = uuidv7();

    const envelope = globalWork({
      workId,
      type: FOUNDATION_DEMO_WORK_TYPE,
      schemaVersion: FOUNDATION_DEMO_SCHEMA_VERSION,
      idempotencyKey,
      correlationId: ctx.correlationId,
      payload: { requestId },
    });

    const result = await demoRepository.createRequestWithOutboxAtomic({
      requestId,
      idempotencyKey,
      correlationId: ctx.correlationId,
      envelope,
    });

    const request = await demoRepository.findRequestById(result.request.id);
    const effect = await demoRepository.findEffectByRequestId(result.request.id);
    const outbox = await demoRepository.findOutboxById(result.workId);

    const response: FoundationWorkResponse = {
      requestId: result.request.id,
      workId: result.workId,
      status: (outbox?.status as any) ?? "queued",
      attemptCount: outbox?.attemptCount ?? 0,
      effectCount: effect ? 1 : 0,
      requestedAt: request?.requestedAt?.toISOString() ?? new Date().toISOString(),
      completedAt: request?.completedAt?.toISOString() ?? null,
      lastErrorCode: outbox?.lastErrorCode ?? null,
    };

    return { response, isNew: result.isNew };
  };
}

export function getFoundationWorkHandler(deps: FoundationWorkHandlerDeps) {
  return async (query: GetFoundationWorkQuery, _ctx: RequestContext): Promise<FoundationWorkResponse> => {
    const { demoRepository, config } = deps;

    if (config.app.env === "production" && !config.foundation.demoEnabled) {
      throw new NotFoundError("Foundation work not found", ErrorCodes.NOT_FOUND);
    }

    const request = await demoRepository.findRequestById(query.requestId);
    if (!request) {
      throw new NotFoundError("Foundation work request not found", ErrorCodes.NOT_FOUND);
    }

    const effect = await demoRepository.findEffectByRequestId(query.requestId);
    let outbox = null;
    if (effect?.outboxId) {
      outbox = await demoRepository.findOutboxById(effect.outboxId);
    } else {
      outbox = await demoRepository.findOutboxByRequestId(query.requestId);
    }

    const status = (outbox?.status as any) ?? "queued";

    return {
      requestId: request.id,
      workId: outbox?.id ?? effect?.outboxId ?? "",
      status,
      attemptCount: outbox?.attemptCount ?? 0,
      effectCount: effect ? 1 : 0,
      requestedAt: request.requestedAt.toISOString(),
      completedAt: request.completedAt?.toISOString() ?? null,
      lastErrorCode: outbox?.lastErrorCode ?? null,
    };
  };
}
