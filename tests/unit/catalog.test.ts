// @vitest-environment node
import { spawnSync } from "node:child_process";
import { describe, expect, it, vi } from "vitest";
import sharp from "sharp";
vi.mock("server-only", () => ({}));
import { createFakeMovieProvider } from "../../src/lib/server/tmdb/fake";
import { TmdbError, type MovieProvider } from "../../src/lib/server/tmdb/client";
import { prepareCatalog } from "../../src/lib/server/catalog/sync";
import { cleanText, sanitizeSynopsis } from "../../src/lib/server/catalog/text";
import { verifyPoster } from "../../src/lib/server/catalog/poster";

const asOf = "2026-11-04";
const story = "A patient traveller follows the distant light through mountains, meeting strangers and searching for a way back to the village before winter comes.";
function providerWithMovie(change: Record<string, unknown> = {}): MovieProvider {
  const fake = createFakeMovieProvider();
  return { ...fake, details: async id => ({ ...await fake.details(id), overview: story, ...change }) };
}

describe("catalog preparation", () => {
  it("deduplicates bounded slices and reports mode gaps without inventing aliases", async () => {
    const probe = vi.fn();
    const result = await prepareCatalog(providerWithMovie(), asOf, probe);
    expect(result.rows).toHaveLength(1);
    expect(result.report).toMatchObject({ candidates: 1, duplicates: 2, accepted: 1, providerCalls: 8,
      posterChecks: 0, tiers: "pending_rc007", activation: "blocked_tiering", source: "fixture", releasedBefore: "2026-08-06" });
    expect(result.rows[0].eligible_modes).toEqual(["title", "synopsis", "genre"]);
    expect(result.rows[0].approved_aliases).toEqual([]);
    expect(result.rows[0].cast_members).toHaveLength(1);
    expect(probe).not.toHaveBeenCalled();
  });

  it.each([
    [{ adult: true }, "adult"], [{ video: true }, "video"], [{ status: "Rumored" }, "unreleased"],
    [{ release_date: "" }, "missing_date"], [{ release_date: "2026-08-07" }, "recent"],
    [{ runtime: 59 }, "runtime"], [{ runtime: null }, "runtime"], [{ vote_count: 499 }, "votes"],
    [{ title: "" }, "title"],
  ])("rejects base-ineligible movie %j", async (change, reason) => {
    const result = await prepareCatalog(providerWithMovie(change), asOf);
    expect(result.rows).toEqual([]);
    expect(result.report.rejected).toEqual({ [reason as string]: 1 });
    expect(result.report.providerCalls).toBe(5);
  });

  it("accepts exact 90-day/runtime/vote boundary; missing credits disable only dependent modes", async () => {
    const provider = providerWithMovie({ release_date: "2026-08-06", runtime: 60, vote_count: 500 });
    provider.credits = async () => { throw new TmdbError("http", false, 404); };
    const result = await prepareCatalog(provider, asOf);
    expect(result.rows[0].eligible_modes).toEqual(["title"]);
    expect(result.rows[0].directors).toEqual([]);
    expect(result.report.modeDisabled).toMatchObject({ synopsis: 1, cast: 1, genre: 1 });
  });

  it("aborts entire preparation on provider outage; never returns partial import", async () => {
    const provider = providerWithMovie();
    provider.aliases = async () => { throw new Error("secret and raw answer"); };
    await expect(prepareCatalog(provider, asOf)).rejects.toThrow("Catalog enrichment failed; no version staged.");
  });

  it("missing aliases/images disable no unrelated mode; corrupt poster disables poster only", async () => {
    const provider = providerWithMovie();
    provider.source = "tmdb";
    provider.aliases = async () => { throw new TmdbError("http", false, 404); };
    provider.images = async () => ({ id: 1, posters: [{ file_path: "/corrupt.jpg", width: 300, height: 450, iso_639_1: "en", vote_average: 0, vote_count: 0 }] });
    const result = await prepareCatalog(provider, asOf, async () => false);
    expect(result.rows[0].poster_path).toBeNull();
    expect(result.rows[0].eligible_modes).toEqual(["title", "synopsis", "genre"]);
    expect(result.rows[0].approved_aliases).toEqual([]);
    expect(result.report.posterChecks).toBe(1);
  });

  it("excludes movie with no usable modes rather than fabricating clues", async () => {
    const provider = providerWithMovie({ title: "It", original_title: "It", overview: null });
    provider.credits = async () => ({ id: 1, crew: [], cast: [] });
    expect((await prepareCatalog(provider, asOf)).report.rejected).toEqual({ no_modes: 1 });
  });

  it("checks real-source poster bytes, preserves cast order and deduplicates people", async () => {
    const provider = providerWithMovie({ poster_path: "/fixture.jpg" });
    provider.source = "tmdb";
    provider.credits = async () => ({ id: 1, crew: [{ id: 9, name: "Director", job: "Director", department: "Directing" }],
      cast: [{ id: 2, name: "Second", order: 2, character: "" }, { id: 1, name: "First", order: 0, character: "" },
        { id: 2, name: "Second", order: 3, character: "" }, { id: 3, name: "Third", order: 4, character: "" }] });
    const probe = vi.fn().mockResolvedValue(true);
    const result = await prepareCatalog(provider, asOf, probe);
    expect(result.rows[0].eligible_modes).toEqual(["poster", "title", "synopsis", "cast", "genre"]);
    expect(result.rows[0].cast_members.map(person => person.id)).toEqual([1, 2, 3]);
    expect(probe).toHaveBeenCalledWith("/fixture.jpg");
  });

  it("bounds calls and candidates even when discovery advertises huge catalog", async () => {
    const provider = providerWithMovie({ adult: true });
    const template = (await provider.details(1));
    let pageCalls = 0;
    provider.discover = async input => {
      pageCalls++;
      return { page: input.page!, total_pages: 500, total_results: 10000,
        results: Array.from({ length: 20 }, (_, i) => ({ ...template, id: (pageCalls - 1) * 20 + i + 1, genre_ids: [] })) };
    };
    provider.details = async id => ({ ...template, id });
    const result = await prepareCatalog(provider, asOf);
    expect(result.report.candidates).toBe(1000);
    expect(pageCalls).toBe(50);
    expect(result.report.providerCalls).toBe(1051);
  });

  it("CLI fixture dry-run needs no secrets and forbids fixture apply", () => {
    const run = (args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", "--conditions=react-server", "scripts/catalog-sync.ts", ...args], {
      encoding: "utf8", timeout: 15000, env: { ...process.env, TMDB_READ_ACCESS_TOKEN: "", TMDB_API_KEY: "", SUPABASE_URL: "", SUPABASE_SECRET_KEY: "" },
    });
    const result = run(["--dry-run", "--fixture"]);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ source: "fixture", status: "dry-run", activation: "blocked_tiering" });
    const forbidden = run(["--apply", "--fixture"]);
    expect(forbidden.status).toBe(1);
    expect(forbidden.stderr).toContain("Fixture apply forbidden");
  });
});

describe("catalog text and poster boundary", () => {
  it("strips markup/entities, blocks malformed HTML and never invents text", () => {
    expect(cleanText('<p>A &amp; B</p><script>secret()</script>')).toBe("A & B");
    expect(cleanText("Bad &unknown; text")).toBeNull();
    expect(cleanText("A <broken")).toBeNull();
  });

  it("redacts normalized whole titles/aliases with Unicode boundaries, not component words", () => {
    const result = sanitizeSynopsis(`FÍCTIONAL—LANTERN meets the fictional lantern. A lantern guides them. ${story}`, ["Fictional Lantern"]);
    expect(result).toContain("[movie] meets the [movie]");
    expect(result).toContain("A lantern guides them");
    expect(result).not.toMatch(/fíctional|fictional lantern/i);
    expect(sanitizeSynopsis(`${"The Café & Stars"} ${story}`, ["The Cafe and Stars"])).toContain("[movie]");
  });

  it("disables unsafe/common/short synopsis and clips at boundary", () => {
    expect(sanitizeSynopsis(story, ["It"])).toBeNull();
    expect(sanitizeSynopsis("Too short.", ["Fictional Lantern"])).toBeNull();
    const result = sanitizeSynopsis(story.repeat(10), ["Fictional Lantern"]);
    expect(result!.length).toBeLessThanOrEqual(600);
    expect(result).not.toMatch(/\s$/);
  });

  it("decodes actual poster pixels and rejects corrupt/missing/oversized/unsafe sources", async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer();
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(new Uint8Array(png)));
    expect(await verifyPoster("/fixture.png", fetcher)).toBe(true);
    expect(fetcher.mock.calls[0]).toMatchObject(["https://image.tmdb.org/t/p/w300/fixture.png", { redirect: "error", cache: "no-store" }]);
    expect(await verifyPoster("https://private.invalid/a", fetcher)).toBe(false);
    expect(await verifyPoster("/corrupt.jpg", async () => new Response("invalid bytes"))).toBe(false);
    expect(await verifyPoster("/missing.jpg", async () => new Response(null, { status: 404 }))).toBe(false);
    expect(await verifyPoster("/large.jpg", async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1)))).toBe(false);
    await expect(verifyPoster("/failure.jpg", async () => new Response(null, { status: 503 }))).rejects.toThrow("Catalog poster provider unavailable.");
  });
});
