import { NextResponse } from "next/server";
import { PLAYER_COOKIE_NAME } from "@/lib/server/game/session";
import { getPlayerDailyStatus } from "@/lib/server/daily/service";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.sessionGet, playerToken);

    const status = await getPlayerDailyStatus(playerToken);

    logTelemetry({
      requestId,
      routeClass: "api.daily.get",
      status: 200,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(
      { ok: true, ...status },
      {
        status: 200,
        headers: createSafeHeaders(requestId),
      }
    );
  } catch (err) {
    logTelemetry({
      requestId,
      routeClass: "api.daily.get",
      status: 500,
      durationMs: Date.now() - start,
      errorCode: "DAILY_STATUS_ERROR",
    });

    return toSafeErrorResponse(err, requestId);
  }
}

