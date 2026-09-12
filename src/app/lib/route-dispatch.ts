import { getAppComposition } from "./composition-root";
import { createRequestContext } from "@/application/shared/context/request-context";
import { getCorrelationIdFromHeaders } from "./correlation";
import { mapErrorToProblem, createProblemResponse } from "./problem-response";
import { getCorsHeaders, getAllowedOrigins, parseAndValidateOrigin } from "./cors";
import { getLogger } from "@/infrastructure/observability/logger";
import { recordHttpRequest, recordHttpFailure } from "@/infrastructure/observability/metrics";

export interface RouteHandlerOptions {
  operation: string;
  requireCors?: boolean;
}

export async function dispatchRoute<TReq>(params: {
  request: Request;
  operation: string;
  parse: (req: Request) => TReq | Promise<TReq>;
  handlerType: string;
}): Promise<Response> {
  const start = Date.now();
  const correlationId = getCorrelationIdFromHeaders(params.request.headers);
  const signal = params.request.signal;

  const originHeader = params.request.headers.get("Origin");
  const origin = parseAndValidateOrigin(originHeader);
  const allowedOrigins = getAllowedOrigins();

  if (origin) {
    const corsHeaders = getCorsHeaders(origin, allowedOrigins);
    if (!corsHeaders) {
      const problem = mapErrorToProblem(new Error("CORS origin not allowed"), correlationId);
      problem.status = 403;
      problem.title = "Origin not allowed";
      return createProblemResponse(problem);
    }
  }

  const context = createRequestContext({
    correlationId,
    signal,
    operation: params.operation,
  });

  const logger = getLogger().child({ correlationId, operation: params.operation });

  try {
    const parsed = await params.parse(params.request);
    // Attach type for dispatcher
    const requestWithType = { ...(parsed as object), type: params.handlerType } as TReq & { type: string };

    const composition = getAppComposition();
    const result = await composition.dispatcher.dispatch(requestWithType as any, context);

    const duration = (Date.now() - start) / 1000;
    logger.info({ status: 200, duration, operation: params.operation, correlationId });

    try {
      recordHttpRequest({ operation: params.operation, status: "200" }, duration);
    } catch {
      void 0;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    };

    if (origin) {
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);
      if (corsHeaders) {
        Object.assign(headers, corsHeaders);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers,
    });
  } catch (error) {
    const problem = mapErrorToProblem(error, correlationId);
    logger.warn({ status: problem.status, code: problem.code, operation: params.operation, correlationId });

    try {
      recordHttpFailure({ operation: params.operation, status: String(problem.status) });
    } catch {
      void 0;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/problem+json",
      "X-Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    };

    if (origin) {
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);
      if (corsHeaders) {
        Object.assign(headers, corsHeaders);
      }
    }

    return new Response(JSON.stringify(problem), {
      status: problem.status,
      headers,
    });
  }
}
