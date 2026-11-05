import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameError,
  PLAYER_COOKIE_NAME,
  submitGameGuess,
  validateOrigin,
} from "@/lib/server/game/session";
import { readBoundedJson } from "@/lib/server/security/body";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { createSafeHeaders, toSafeErrorResponse } from "@/lib/server/security/response";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const dynamic = "force-dynamic";

const guessSchema = z.object({
  roundId: z.string().uuid(),
  actionId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
  answerText: z.string().optional(),
  choiceHandle: z.string().optional(),
}).refine(data => (data.answerText !== undefined) !== (data.choiceHandle !== undefined), {
  message: "Must provide exactly one of answerText or choiceHandle",
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const start = Date.now();
  const requestId = generateRequestId();

  try {
    validateOrigin(request);
    const { id } = await props.params;

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      throw new GameError(401, "UNAUTHORIZED", "Player identity cookie required", false);
    }

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.gameMutation, playerToken);

    const json = await readBoundedJson(request);
    const parsed = guessSchema.safeParse(json);
    if (!parsed.success) {
      throw new GameError(
        400,
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid request",
        false
      );
    }

    const result = await submitGameGuess({
      playerToken,
      sessionId: id,
      actionId: parsed.data.actionId,
      roundId: parsed.data.roundId,
      revision: parsed.data.revision,
      answerText: parsed.data.answerText,
      choiceHandle: parsed.data.choiceHandle,
    });

    logTelemetry({
      requestId,
      routeClass: "api.games.guess",
      status: 200,
      durationMs: Date.now() - start,
    });

    return NextResponse.json(result, {
      status: 200,
      headers: createSafeHeaders(requestId),
    });
  } catch (err) {
    const errorStatus = err instanceof GameError ? err.status : 500;
    const errorCode = err instanceof GameError ? err.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.games.guess",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    return toSafeErrorResponse(err, requestId);
  }
}
