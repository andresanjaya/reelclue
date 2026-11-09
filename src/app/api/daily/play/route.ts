import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameError,
  PLAYER_COOKIE_NAME,
  validateOrigin,
} from "@/lib/server/game/session";
import { startDailyChallenge } from "@/lib/server/daily/service";
import { readBoundedJson } from "@/lib/server/security/body";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

const playDailySchema = z.object({
  actionId: z.string().uuid(),
  isPractice: z.boolean().optional(),
});

export async function POST(request: Request) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    validateOrigin(request);

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      throw new GameError(401, "UNAUTHORIZED", "Player identity cookie required", false);
    }

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.sessionCreate, playerToken);

    const json = await readBoundedJson(request);
    const parsed = playDailySchema.safeParse(json);
    if (!parsed.success) {
      throw new GameError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid request",
        false
      );
    }

    const result = await startDailyChallenge({
      playerToken,
      actionId: parsed.data.actionId,
      isPractice: parsed.data.isPractice,
    });

    logTelemetry({
      requestId,
      routeClass: "api.daily.play",
      status: result.isResumed ? 200 : 201,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { ok: true, ...result },
      {
        status: result.isResumed ? 200 : 201,
        headers: createSafeHeaders(requestId),
      }
    );
  } catch (err) {
    const errorStatus = err instanceof GameError ? err.status : 500;
    const errorCode = err instanceof GameError ? err.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.daily.play",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    return toSafeErrorResponse(err, requestId);
  }
}

