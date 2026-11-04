import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createGameSession,
  GameError,
  PLAYER_COOKIE_NAME,
  validateOrigin,
} from "@/lib/server/game/session";

export const dynamic = "force-dynamic";

const createGameSchema = z.object({
  mode: z.enum(["poster", "title", "synopsis", "cast", "genre", "mixed"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  actionId: z.string().uuid(),
});

export async function POST(request: Request) {
  try {
    validateOrigin(request);

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
    const parsed = createGameSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid request", retryable: false } },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const session = await createGameSession({
      playerToken,
      actionId: parsed.data.actionId,
      mode: parsed.data.mode,
      level: parsed.data.difficulty,
    });

    return NextResponse.json(session, {
      status: 201,
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
