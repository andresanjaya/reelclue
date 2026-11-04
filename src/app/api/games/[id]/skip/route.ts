import { NextResponse } from "next/server";
import { z } from "zod";
import {
  GameError,
  mutateGameAction,
  PLAYER_COOKIE_NAME,
  validateOrigin,
} from "@/lib/server/game/session";

export const dynamic = "force-dynamic";

const skipSchema = z.object({
  roundId: z.string().uuid(),
  actionId: z.string().uuid(),
  revision: z.number().int().nonnegative(),
});

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    validateOrigin(request);
    const { id } = await props.params;

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Player identity cookie required", retryable: false } },
        { status: 401, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const json = await request.json().catch(() => null);
    const parsed = skipSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid request", retryable: false } },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const session = await mutateGameAction({
      playerToken,
      sessionId: id,
      actionId: parsed.data.actionId,
      actionType: "skip",
      roundId: parsed.data.roundId,
      revision: parsed.data.revision,
    });

    return NextResponse.json(session, {
      status: 200,
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (err) {
    if (err instanceof GameError) {
      return NextResponse.json(
        { error: { code: err.code, message: err.message, retryable: err.retryable } },
        { status: err.status, headers: { "Cache-Control": "no-store, private" } }
      );
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message, retryable: false } },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
