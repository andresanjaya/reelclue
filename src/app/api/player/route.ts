import { NextResponse } from "next/server";
import {
  GameError,
  getOrCreatePlayer,
  PLAYER_COOKIE_NAME,
  validateOrigin,
} from "@/lib/server/game/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    validateOrigin(request);

    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const existingToken = match ? match[1] : undefined;

    const player = await getOrCreatePlayer(existingToken);

    const response = NextResponse.json(
      { ok: true },
      {
        status: player.isNew ? 201 : 200,
        headers: { "Cache-Control": "no-store, private" },
      }
    );

    if (player.isNew) {
      response.cookies.set(PLAYER_COOKIE_NAME, player.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
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
