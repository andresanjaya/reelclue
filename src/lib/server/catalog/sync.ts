import "server-only";
import { z } from "zod";
import { TmdbError, type MovieProvider } from "../tmdb/client.ts";
import { schemas } from "../tmdb/schemas.ts";
import { cleanText, sanitizeSynopsis } from "./text.ts";
import { verifyPoster } from "./poster.ts";
import { assignTiers, type OverrideEntry, type Tier } from "./tiering.ts";

export const catalogRules = "base-v1";
export const modes = ["poster", "title", "synopsis", "cast", "genre"] as const;
type Mode = typeof modes[number];

export type CatalogMovie = {
  tmdb_id: number; title: string; original_title: string; release_date: string; release_year: number;
  vote_count: number; vote_average: number; popularity: number; revenue: number | null; runtime: number;
  original_language: string; genres: string[]; sanitized_synopsis: string | null;
  directors: Array<{ id: number; name: string }>; cast_members: Array<{ id: number; name: string }>;
  approved_aliases: string[]; poster_path: string | null; source_revision: string; eligible_modes: Mode[];
  tier: Tier | null; familiarity_score: number | null;
};

export async function prepareCatalog(provider: MovieProvider, asOf: string,
  posterProbe: (path: string) => Promise<boolean> = verifyPoster,
  overrides: readonly OverrideEntry[] = []) {
  if (!z.iso.date().safeParse(asOf).success || !["tmdb", "fixture"].includes(provider.source)) throw new Error("Invalid catalog input.");
  const cutoff = new Date(`${asOf}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  const releasedBefore = cutoff.toISOString().slice(0, 10);
  const ids = new Set<number>();
  let duplicates = 0;
  let calls = 0;
  const rejected: Record<string, number> = {};
  const modeDisabled = Object.fromEntries(modes.map(mode => [mode, 0])) as Record<Mode, number>;
  const reject = (reason: string) => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
  const optional = async <T>(request: () => Promise<T>, fallback: T) => {
    try { return await request(); } catch (error) {
      if (error instanceof TmdbError && error.status === 404) return fallback;
      throw error;
    }
  };
  schemas.configuration.parse(await provider.configuration()); calls++;
  for (const sortBy of ["vote_count.desc", "popularity.desc", "vote_average.desc"] as const) {
    for (let page = 1; page <= 17 && ids.size < 1000; page++) {
      const batch = schemas.discover.parse(await provider.discover({ sortBy, page, releasedBefore, ...(sortBy === "vote_average.desc" ? { minRating: 7 } : {}) }));
      calls++;
      for (const movie of batch.results) {
        if (ids.has(movie.id)) duplicates++;
        else if (ids.size < 1000) ids.add(movie.id);
      }
      if (page >= batch.total_pages) break;
    }
  }
  const rows: CatalogMovie[] = [];
  const candidates = [...ids];
  let cursor = 0;
  let failed = false;
  let posterChecks = 0;
  const worker = async () => {
    while (!failed && cursor < candidates.length) {
      const id = candidates[cursor++];
      try {
        calls++;
        const movie = schemas.details.parse(await provider.details(id));
        if (movie.id !== id) throw new Error("Catalog provider identity mismatch.");
        const reason = movie.adult ? "adult" : movie.video ? "video" : movie.status !== "Released" ? "unreleased" :
          !movie.release_date ? "missing_date" : movie.release_date > releasedBefore ? "recent" :
          movie.runtime === null || movie.runtime < 60 ? "runtime" : movie.vote_count < 500 ? "votes" : null;
        if (reason) { reject(reason); continue; }
        const title = cleanText(movie.title);
        const original = cleanText(movie.original_title);
        if (!title || !original) { reject("title"); continue; }
        calls++;
        const credits = schemas.credits.parse(await optional(() => provider.credits(id), { id, cast: [], crew: [] }));
        calls++;
        const aliases = schemas.aliases.parse(await optional(() => provider.aliases(id), { id, titles: [] }));
        if (credits.id !== id || aliases.id !== id) throw new Error("Catalog provider identity mismatch.");
        const people = (items: Array<{ id: number; name: string }>) => {
          const unique = new Map<number, { id: number; name: string }>();
          for (const person of items) {
            const name = cleanText(person.name);
            if (name && !unique.has(person.id)) unique.set(person.id, { id: person.id, name });
          }
          return [...unique.values()];
        };
        const directors = people(credits.crew.filter(person => person.job === "Director"));
        const cast = people([...credits.cast].sort((a, b) => a.order - b.order));
        const genres = [...new Set(movie.genres.map(genre => cleanText(genre.name)).filter((name): name is string => !!name))];
        // Provider alternatives are not reviewed answer aliases. Redact conservatively, never auto-approve.
        const synopsis = sanitizeSynopsis(movie.overview, [title, original, ...aliases.titles.map(alias => alias.title)]);
        let poster = movie.poster_path;
        if (!poster) {
          calls++;
          const images = schemas.images.parse(await optional(() => provider.images(id), { id, posters: [] }));
          if (images.id !== id) throw new Error("Catalog provider identity mismatch.");
          poster = images.posters.find(image => image.iso_639_1 === "en")?.file_path ?? images.posters[0]?.file_path ?? null;
        }
        let posterValid = false;
        if (poster && provider.source === "tmdb") { posterChecks++; posterValid = await posterProbe(poster); }
        if (!posterValid) poster = null;
        const maskable = [...new Intl.Segmenter("en", { granularity: "grapheme" }).segment(title)].filter(part => /[\p{L}\p{N}]/u.test(part.segment)).length;
        const flags: Record<Mode, boolean> = { poster: posterValid, title: maskable >= 5,
          synopsis: synopsis !== null && directors.length > 0 && genres.length > 0,
          cast: directors.length > 0 && cast.length >= 3,
          genre: genres.length > 0 && directors.length > 0 && cast.length > 0 && !!movie.original_language };
        const eligible = modes.filter(mode => flags[mode]);
        for (const mode of modes) if (!flags[mode]) modeDisabled[mode]++;
        if (!eligible.length) { reject("no_modes"); continue; }
        rows.push({ tmdb_id: id, title, original_title: original, release_date: movie.release_date,
          release_year: Number(movie.release_date.slice(0, 4)), vote_count: movie.vote_count, vote_average: movie.vote_average,
          popularity: movie.popularity, revenue: movie.revenue, runtime: movie.runtime!, original_language: movie.original_language,
          genres, sanitized_synopsis: synopsis, directors, cast_members: cast.slice(0, 5), approved_aliases: [], poster_path: poster,
          source_revision: `${catalogRules}:${asOf}`, eligible_modes: eligible, tier: null, familiarity_score: null });
      } catch (error) {
        if (error instanceof TmdbError && error.status === 404) { reject("not_found"); continue; }
        failed = true;
        throw new Error("Catalog enrichment failed; no version staged.");
      }
    }
  };
  const workers = await Promise.allSettled(Array.from({ length: 4 }, worker));
  if (workers.some(worker => worker.status === "rejected")) throw new Error("Catalog enrichment failed; no version staged.");
  rows.sort((a, b) => a.tmdb_id - b.tmdb_id);

  const { approved, report: tierReport } = assignTiers(rows, overrides);
  const activation = provider.source === "fixture"
    ? "blocked_fixture"
    : tierReport.shortages.length > 0
      ? "blocked_coverage"
      : "ready";

  return {
    rows: approved,
    report: {
      source: provider.source,
      rulesVersion: catalogRules,
      tieringVersion: tierReport.tieringVersion,
      asOf,
      releasedBefore,
      candidates: ids.size,
      duplicates,
      baseAccepted: rows.length,
      approved: approved.length,
      unassigned: tierReport.unassigned,
      rejected,
      modeDisabled,
      bands: tierReport.bands,
      gateFailures: tierReport.gateFailures,
      tiers: tierReport.tiers,
      coverage: tierReport.coverage,
      shortages: tierReport.shortages,
      overridesApplied: tierReport.overridesApplied,
      calibrationSample: tierReport.calibrationSample,
      activation,
      providerCalls: calls,
      posterChecks,
      maxProviderCalls: 4052,
      maxProviderAttempts: 12156,
    },
  };
}
