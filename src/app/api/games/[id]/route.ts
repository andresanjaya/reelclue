import { NextResponse } from "next/server";
import {
  fetchSafeSession,
  GameError,
  hashToken,
  PLAYER_COOKIE_NAME,
} from "@/lib/server/game/session";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
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

    const session = await fetchSafeSession(id, hashToken(playerToken));

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
