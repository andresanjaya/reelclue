import { createDbClient } from "@/lib/server/db/client";
import { fetchSafeSession, GameError, hashToken, PLAYER_COOKIE_NAME } from "@/lib/server/game/session";
import { transformPoster } from "@/lib/server/game/poster";
import { enforceRateLimits, RATE_LIMIT_POLICIES } from "@/lib/server/security/rate-limit";
import { generateRequestId, logTelemetry } from "@/lib/server/security/telemetry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

type RoundPosterMeta = {
  movie_id: number;
  poster_path: string;
  source_revision: string;
};

const roundMetaCache = new Map<string, RoundPosterMeta>();

export function _resetRoundMetaCacheForTesting(): void {
  roundMetaCache.clear();
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string; roundId: string }> }) {
  const start = Date.now();
  const requestId = generateRequestId();
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

    await enforceRateLimits(request, RATE_LIMIT_POLICIES.poster, token);

    let meta = roundMetaCache.get(roundId);
    if (!meta) {
      const db = createDbClient();
      const { data: roundData, error: roundError } = await db.from("game_rounds")
        .select("movie_id, catalog_version_id")
        .eq("id", roundId).eq("session_id", id).maybeSingle();
      if (roundError) {
        return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "5" } });
      }
      if (!roundData) return new Response(null, { status: 404, headers });
      const { data: movie, error: movieError } = await db.from("movies")
        .select("poster_path, source_revision")
        .eq("catalog_version_id", roundData.catalog_version_id)
        .eq("tmdb_id", roundData.movie_id).maybeSingle();
      if (movieError || !movie?.poster_path) {
        return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "5" } });
      }
      meta = {
        movie_id: roundData.movie_id,
        poster_path: movie.poster_path,
        source_revision: movie.source_revision,
      };
      if (roundMetaCache.size >= 128) roundMetaCache.delete(roundMetaCache.keys().next().value!);
      roundMetaCache.set(roundId, meta);
    }

    const bytes = await transformPoster(meta.poster_path, meta.source_revision, meta.movie_id, stage);

    logTelemetry({
      requestId,
      routeClass: "api.games.poster",
      status: 200,
      durationMs: Date.now() - start,
    });

    return new Response(new Uint8Array(bytes), { headers: { ...headers, "Content-Type": "image/webp", "X-Request-ID": requestId } });
  } catch (error) {
    const errorStatus = error instanceof GameError ? error.status : 503;
    const errorCode = error instanceof GameError ? error.code : "INTERNAL_ERROR";

    logTelemetry({
      requestId,
      routeClass: "api.games.poster",
      status: errorStatus,
      durationMs: Date.now() - start,
      errorCode,
    });

    if (error instanceof GameError) {
      const errHeaders: Record<string, string> = { ...headers, "X-Request-ID": requestId };
      if (error.retryAfter !== undefined) {
        errHeaders["Retry-After"] = String(error.retryAfter);
      } else if (error.status === 503) {
        errHeaders["Retry-After"] = "5";
      }
      return new Response(null, { status: error.status, headers: errHeaders });
    }
    return new Response(null, { status: 503, headers: { ...headers, "Retry-After": "5", "X-Request-ID": requestId } });
  }
}
