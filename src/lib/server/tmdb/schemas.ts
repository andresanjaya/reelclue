import "server-only";
import { z } from "zod";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const date = z.union([z.iso.date(), z.literal("")]);
const path = z.string().regex(/^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/).nullable();
const genre = z.object({ id, name: z.string() });
const movie = z.object({
  id, title: z.string(), original_title: z.string(), original_language: z.string(),
  adult: z.boolean(), video: z.boolean(), release_date: date,
  overview: z.string().nullable(), poster_path: path,
  vote_count: z.number().int().nonnegative(), vote_average: z.number().min(0).max(10),
  popularity: z.number().nonnegative(),
});

export const schemas = {
  configuration: z.object({ images: z.object({
    secure_base_url: z.literal("https://image.tmdb.org/t/p/"),
    poster_sizes: z.array(z.string().regex(/^(w\d+|original)$/)),
  }) }),
  genres: z.object({ genres: z.array(genre) }),
  discover: z.object({ page: z.number().int().positive(), total_pages: z.number().int().nonnegative(),
    total_results: z.number().int().nonnegative(), results: z.array(movie.extend({ genre_ids: z.array(id) })).max(20) }),
  details: movie.extend({ status: z.string(), runtime: z.number().int().nonnegative().nullable(),
    revenue: z.number().int().nonnegative().nullable(), genres: z.array(genre) }),
  credits: z.object({ id, cast: z.array(z.object({ id, name: z.string(), order: z.number().int().nonnegative(), character: z.string() })),
    crew: z.array(z.object({ id, name: z.string(), job: z.string(), department: z.string() })) }),
  aliases: z.object({ id, titles: z.array(z.object({ iso_3166_1: z.string(), title: z.string(), type: z.string() })) }),
  images: z.object({ id, posters: z.array(z.object({ file_path: path.unwrap(), width: z.number().int().positive(),
    height: z.number().int().positive(), iso_639_1: z.string().nullable(), vote_average: z.number().min(0).max(10),
    vote_count: z.number().int().nonnegative() })) }),
};

export const discoverInput = z.object({
  page: z.number().int().min(1).max(500).default(1),
  sortBy: z.enum(["vote_count.desc", "popularity.desc", "vote_average.desc"]),
  releasedBefore: z.iso.date(),
  minVotes: z.number().int().min(500).default(500),
  maxVotes: z.number().int().min(500).optional(),
  minRating: z.number().min(0).max(10).optional(),
}).strict().refine(value => value.maxVotes === undefined || value.maxVotes >= value.minVotes);

export type DiscoverInput = z.input<typeof discoverInput>;
