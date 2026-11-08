// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { safeSession, dbClient, transform } = vi.hoisted(() => ({
  safeSession: vi.fn(), dbClient: vi.fn(), transform: vi.fn(),
}));
vi.mock("../../src/lib/server/game/session", () => ({
  fetchSafeSession: safeSession, hashToken: () => "hashed", PLAYER_COOKIE_NAME: "reelclue_player", GameError: class GameError extends Error { status = 404; },
}));
vi.mock("../../src/lib/server/db/client", () => ({ createDbClient: dbClient }));
vi.mock("../../src/lib/server/security/rate-limit", () => ({ enforceRateLimits: vi.fn(), RATE_LIMIT_POLICIES: { poster: [] } }));
vi.mock("../../src/lib/server/game/poster", () => ({ transformPoster: transform }));
import { _resetRoundMetaCacheForTesting, GET } from "../../src/app/api/games/[id]/rounds/[roundId]/poster/route";

const route = (stage = "0", cookie = "reelclue_player=token", roundId = "round") => GET(
  new Request(`http://localhost/api/games/session/rounds/${roundId}/poster?stage=${stage}`, { headers: { cookie } }),
  { params: Promise.resolve({ id: "session", roundId }) }
);

describe("private poster endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetRoundMetaCacheForTesting();
    safeSession.mockResolvedValue({ active_round: { id: "round", mode: "poster", state: "guessing", hint_stage: 1 } });
    const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    query.maybeSingle.mockResolvedValueOnce({ data: { movie_id: 42, catalog_version_id: "catalog" }, error: null })
      .mockResolvedValueOnce({ data: { poster_path: "/source.jpg", source_revision: "v1" }, error: null });
    dbClient.mockReturnValue({ from: vi.fn(() => query) });
    transform.mockResolvedValue(Buffer.from([82, 73, 70, 70]));
  });

  it("requires cookie, authorized round, and authorized stage before DB/image read", async () => {
    expect((await route("0", "")).status).toBe(401);
    expect((await route("9")).status).toBe(400);
    expect((await route("2")).status).toBe(404);
    expect((await route("0", "reelclue_player=token", "future")).status).toBe(404);
    expect(dbClient).not.toHaveBeenCalled();
    expect(transform).not.toHaveBeenCalled();
  });

  it("serves private transformed image without source path in response", async () => {
    const response = await route("1");
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/webp");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(transform).toHaveBeenCalledWith("/source.jpg", "v1", 42, 1);
    expect(await response.text()).not.toContain("source.jpg");
  });

  it("never serves image for terminal rounds or upstream failure", async () => {
    safeSession.mockResolvedValue({ active_round: { id: "round", mode: "poster", state: "correct", hint_stage: 1 } });
    expect((await route()).status).toBe(404);
    safeSession.mockResolvedValue({ active_round: { id: "round", mode: "poster", state: "guessing", hint_stage: 1 } });
    transform.mockRejectedValue(new Error("upstream"));
    const response = await route();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
  });
});
