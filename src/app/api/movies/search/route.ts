import { NextResponse } from "next/server";
import { PLAYER_COOKIE_NAME } from "@/lib/server/game/session";
import { searchCatalogMovies } from "@/lib/server/catalog/search";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`));
    const playerToken = match ? match[1] : undefined;

    if (!playerToken) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Player identity cookie required", retryable: false } },
        { status: 401, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (query === null || query.trim().length < 2) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Search query must be at least 2 characters", retryable: false } },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    if (query.length > 100) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: "Search query exceeds 100 characters", retryable: false } },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const items = await searchCatalogMovies(query.trim(), 8);

    return NextResponse.json(
      { items },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, private" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message, retryable: false } },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
