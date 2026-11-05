import { createDbClient } from "@/lib/server/db/client";
import { fetchSafeSession, GameError, hashToken, PLAYER_COOKIE_NAME } from "@/lib/server/game/session";
import { transformPoster } from "@/lib/server/game/poster";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

export async function GET(request: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const { id, roundId } = await params;
  const stageText = new URL(request.url).searchParams.get("stage");
  if (!stageText || !/^[0-3]$/.test(stageText)) return new Response(null, { status: 400, headers });
  const token = request.headers.get("cookie")?.match(new RegExp(`(?:^|; )${PLAYER_COOKIE_NAME}=([^;]*)`))?.[1];
  if (!token) return new Response(null, { status: 401, headers });

  try {
    const session = await fetchSafeSession(id, hashToken(token));
    const round = session.active_round;
    if (round.id !== roundId || round.mode !== "poster" || round.state !== "guessing") {
      return new Response(null, { status: 404, headers });
    }
    const stage = Number(stageText);
    if (stage > round.hint_stage) return new Response(null, { status: 404, headers });
    const db = createDbClient();
    const { data: roundData, error: roundError } = await db.from("game_rounds")
      .select("movie_id, catalog_version_id")
      .eq("id", roundId).eq("session_id", id).maybeSingle();
    if (roundError) {
      return new Response(null, { status: 503, headers });
    }
    if (!roundData) return new Response(null, { status: 404, headers });
    const { data: movie, error: movieError } = await db.from("movies")
      .select("poster_path, source_revision")
      .eq("catalog_version_id", roundData.catalog_version_id)
      .eq("tmdb_id", roundData.movie_id).maybeSingle();
    if (movieError || !movie?.poster_path) {
      return new Response(null, { status: 503, headers });
    }
    const bytes = await transformPoster(movie.poster_path, movie.source_revision, roundData.movie_id, stage);
    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp" } });
  } catch (error) {
    if (error instanceof GameError) return new Response(null, { status: error.status, headers });
    return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "5" } });
  }
}
