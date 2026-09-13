import { getAppComposition } from "./composition-root";
import { createRequestContext } from "@/application/shared/context/request-context";
import { getCorrelationIdFromHeaders } from "./correlation";
import { mapErrorToProblem, createProblemResponse } from "./problem-response";
import { getCorsHeaders, getAllowedOrigins, getAppOrigin, getRequestHost, parseAndValidateOrigin } from "./cors";
import { getLogger } from "@/infrastructure/observability/logger";
import { recordHttpRequest, recordHttpFailure } from "@/infrastructure/observability/metrics";
import { UnauthorizedError } from "@/application/shared/errors/app-error";
import { ErrorCodes } from "@/application/shared/errors/error-codes";
import {
  buildClearSessionCookieHeader,
  buildSessionCookieHeader,
  readSessionTokenFromCookieHeader,
} from "@/infrastructure/identity/auth/session-cookie";

export interface RouteHandlerOptions {
  operation: string;
  requireCors?: boolean;
}

export async function dispatchRoute<TReq>(params: {
  request: Request;
  operation: string;
  parse: (req: Request) => TReq | Promise<TReq>;
  handlerType: string;
  auth?: "none" | "optional" | "required";
  successStatus?: number;
  sessionCookie?: boolean;
  clearSessionCookie?: boolean;
  emptyBody?: boolean;
}): Promise<Response> {
  const start = Date.now();
  const correlationId = getCorrelationIdFromHeaders(params.request.headers);
  const signal = params.request.signal;
  const authMode = params.auth ?? "none";

  const originHeader = params.request.headers.get("Origin");
  const origin = parseAndValidateOrigin(originHeader);
  const allowedOrigins = getAllowedOrigins();
  const originCheck = { appOrigin: getAppOrigin(), requestHost: getRequestHost(params.request.headers) };

  if (origin) {
    const corsHeaders = getCorsHeaders(origin, allowedOrigins, originCheck);
    if (!corsHeaders) {
      const problem = mapErrorToProblem(new Error("CORS origin not allowed"), correlationId);
      problem.status = 403;
      problem.title = "Origin not allowed";
      return createProblemResponse(problem);
    }
  }

  const logger = getLogger().child({ correlationId, operation: params.operation });

  try {
    const composition = getAppComposition();
    const rawToken = readSessionTokenFromCookieHeader(params.request.headers.get("Cookie"));
    const actor = await composition.sessionService.resolveActor(rawToken);

    if (authMode === "required" && !actor) {
      throw new UnauthorizedError("Authentication required", ErrorCodes.AUTHENTICATION_FAILED);
    }

    const context = createRequestContext({
      correlationId,
      signal,
      operation: params.operation,
      actor,
      orgId: actor?.activeOrgId ?? null,
    });

    const parsed = await params.parse(params.request);
    const requestWithType = { ...(parsed as object), type: params.handlerType } as TReq & { type: string };

    const result = await composition.dispatcher.dispatch(requestWithType as any, context);

    const duration = (Date.now() - start) / 1000;
    const status = params.successStatus ?? 200;
    logger.info({ status, duration, operation: params.operation, correlationId });

    try {
      recordHttpRequest({ operation: params.operation, status: String(status) }, duration);
    } catch {
      void 0;
    }

    const headers: Record<string, string> = {
      "X-Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    };

    if (origin) {
      const corsHeaders = getCorsHeaders(origin, allowedOrigins, originCheck);
      if (corsHeaders) Object.assign(headers, corsHeaders);
    }

    const secure = composition.config.app.env === "production";
    if (params.sessionCookie && result && typeof result === "object" && "rawSessionToken" in (result as any)) {
      headers["Set-Cookie"] = buildSessionCookieHeader((result as any).rawSessionToken, {
        secure,
        maxAgeSeconds: composition.config.auth.sessionMaxAge,
      });
    }
    if (params.clearSessionCookie) {
      headers["Set-Cookie"] = buildClearSessionCookieHeader(secure);
    }

    if (params.emptyBody || status === 204) {
      return new Response(null, { status, headers });
    }

    let body: unknown = result;
    if (result && typeof result === "object" && "sessionContext" in (result as any) && "rawSessionToken" in (result as any)) {
      body = (result as any).sessionContext;
    }

    headers["Content-Type"] = "application/json";
    return new Response(JSON.stringify(body), { status, headers });
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
      const corsHeaders = getCorsHeaders(origin, allowedOrigins, originCheck);
      if (corsHeaders) Object.assign(headers, corsHeaders);
    }

    return new Response(JSON.stringify(problem), {
      status: problem.status,
      headers,
    });
  }
}
