import { CREATE_FOUNDATION_WORK_TYPE } from "@/application/foundation/commands/work";
import { getAppComposition } from "@/app/lib/composition-root";
import { createRequestContext } from "@/application/shared/context/request-context";
import { getCorrelationIdFromHeaders } from "@/app/lib/correlation";
import { mapErrorToProblem } from "@/app/lib/problem-response";
import { getCorsHeaders, getAllowedOrigins, parseAndValidateOrigin } from "@/app/lib/cors";
import { getLogger } from "@/infrastructure/observability/logger";

export async function POST(request: Request): Promise<Response> {
  const start = Date.now();
  const correlationId = getCorrelationIdFromHeaders(request.headers);
  const signal = request.signal;

  const originHeader = request.headers.get("Origin");
  const origin = parseAndValidateOrigin(originHeader);
  const allowedOrigins = getAllowedOrigins();

  if (origin) {
    const corsHeaders = getCorsHeaders(origin, allowedOrigins);
    if (!corsHeaders) {
      const problem = mapErrorToProblem(new Error("CORS origin not allowed"), correlationId);
      problem.status = 403;
      problem.title = "Origin not allowed";
      const headers: Record<string, string> = {
        "Content-Type": "application/problem+json",
        "X-Correlation-Id": correlationId,
        "Cache-Control": "no-store",
      };
      return new Response(JSON.stringify(problem), { status: problem.status, headers });
    }
  }

  const context = createRequestContext({
    correlationId,
    signal,
    operation: "createFoundationWork",
  });

  const logger = getLogger().child({ correlationId, operation: "createFoundationWork" });

  try {
    const idempotencyKey = request.headers.get("Idempotency-Key") ?? undefined;

    // Parse body - must be empty object per contract (maxProperties 0)
    let body: any = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
        if (Object.keys(body).length > 0) {
          throw new Error("Body must be empty");
        }
      }
    } catch (e) {
      if ((e as Error).message === "Body must be empty") {
        throw e;
      }
      // If body is not JSON, treat as empty
      body = {};
    }

    const composition = getAppComposition();
    const command = {
      type: CREATE_FOUNDATION_WORK_TYPE,
      idempotencyKey,
      correlationId,
    };

    const result = (await composition.dispatcher.dispatch(command as any, context)) as {
      response: any;
      isNew: boolean;
    };

    const duration = (Date.now() - start) / 1000;
    logger.info({ status: result.isNew ? 202 : 200, duration, operation: "createFoundationWork", correlationId });

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Correlation-Id": correlationId,
      Location: `/api/v1/foundation/work/${result.response.requestId}`,
    };

    if (origin) {
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);
      if (corsHeaders) Object.assign(headers, corsHeaders);
    }

    return new Response(JSON.stringify(result.response), {
      status: result.isNew ? 202 : 200,
      headers,
    });
  } catch (error) {
    const problem = mapErrorToProblem(error, correlationId);
    logger.warn({ status: problem.status, code: problem.code, operation: "createFoundationWork", correlationId });

    const headers: Record<string, string> = {
      "Content-Type": "application/problem+json",
      "X-Correlation-Id": correlationId,
      "Cache-Control": "no-store",
    };

    if (origin) {
      const corsHeaders = getCorsHeaders(origin, allowedOrigins);
      if (corsHeaders) Object.assign(headers, corsHeaders);
    }

    return new Response(JSON.stringify(problem), {
      status: problem.status,
      headers,
    });
  }
}

export const dynamic = "force-dynamic";
