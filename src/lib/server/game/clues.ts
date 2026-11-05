import "server-only";

export type ClueMode = "poster" | "title" | "synopsis" | "cast" | "genre";

export type MovieDetails = {
  tmdb_id: number;
  title: string;
  original_title: string;
  release_year: number;
  original_language: string;
  genres: string[];
  sanitized_synopsis: string | null;
  directors: Array<{ id: number; name: string }>;
  cast_members: Array<{ id: number; name: string }>;
  poster_path: string | null;
};

function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function maskTitleByGrapheme(title: string, seed: string, stage: number): string {
  const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" });
  const graphemes = Array.from(segmenter.segment(title), s => s.segment);
  const isMaskable = (char: string) => /\p{L}|\p{N}/u.test(char);

  const maskableIndices: number[] = [];
  graphemes.forEach((g, idx) => {
    if (isMaskable(g)) maskableIndices.push(idx);
  });

  const n = maskableIndices.length;
  if (n < 5) throw new Error("Title is not eligible for Missing Title mode");

  // PRD fraction rules: 0.35, 0.50, 0.65, 0.80
  const fractions = [0.35, 0.5, 0.65, 0.8];
  const frac = fractions[Math.min(Math.max(0, stage), 3)];
  const revealCount = Math.min(n - 1, Math.max(1, Math.floor(n * frac)));

  // Seeded deterministic Fisher-Yates permutation
  const rng = mulberry32(seedFromString(seed));
  const order = [...maskableIndices];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = order[i];
    order[i] = order[j];
    order[j] = tmp;
  }

  const revealedSet = new Set(order.slice(0, revealCount));
  return graphemes
    .map((g, idx) => {
      if (!isMaskable(g)) return g;
      return revealedSet.has(idx) ? g : "_";
    })
    .join("");
}

export function clipSynopsis(synopsis: string, maxLength = 600): string {
  if (synopsis.length <= maxLength) return synopsis;
  const slice = synopsis.slice(0, maxLength);
  if (/[.!?]$/.test(slice)) return slice;
  const sentenceEnd = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  if (sentenceEnd >= 100) {
    return slice.slice(0, sentenceEnd + 1);
  }
  const maxWordSlice = synopsis.slice(0, maxLength - 3);
  const lastSpace = maxWordSlice.lastIndexOf(" ");
  if (lastSpace >= 100) {
    return maxWordSlice.slice(0, lastSpace) + "...";
  }
  return maxWordSlice + "...";
}

export type SafeClue =
  | {
      mode: "poster";
      posterUrl: string;
      releaseYear?: number;
      primaryGenre?: string;
    }
  | {
      mode: "title";
      maskedTitle: string;
    }
  | {
      mode: "synopsis";
      synopsis: string;
      decade?: string;
      primaryGenre?: string;
      director?: string;
    }
  | {
      mode: "cast";
      director: string;
      cast?: string[];
      releaseYear?: number;
    }
  | {
      mode: "genre";
      genres: string[];
      decade: string;
      originalLanguage?: string;
      director?: string;
      leadActor?: string;
      releaseYear?: number;
    };

export function buildSafeClue(
  mode: ClueMode,
  stage: number,
  movie: MovieDetails,
  sessionId: string,
  roundId: string,
  revealSeed: string
): SafeClue {
  const decade = `${Math.floor(movie.release_year / 10) * 10}s`;
  const primaryDirector = movie.directors[0]?.name ?? "Unknown";
  const primaryGenre = movie.genres[0] ?? "Unknown";

  switch (mode) {
    case "poster": {
      const clue: SafeClue = {
        mode: "poster",
        posterUrl: `/api/games/${sessionId}/rounds/${roundId}/poster?stage=${Math.min(stage, 3)}`,
      };
      if (stage >= 3) {
        clue.releaseYear = movie.release_year;
        clue.primaryGenre = primaryGenre;
      }
      return clue;
    }

    case "title": {
      return {
        mode: "title",
        maskedTitle: maskTitleByGrapheme(movie.title, revealSeed, stage),
      };
    }

    case "synopsis": {
      if (
        !movie.sanitized_synopsis ||
        movie.sanitized_synopsis.trim().length < 100 ||
        movie.directors.length === 0 ||
        movie.genres.length === 0
      ) {
        throw new Error("Movie is not eligible for Synopsis mode");
      }
      const baseSynopsis = clipSynopsis(movie.sanitized_synopsis);
      const clue: SafeClue = {
        mode: "synopsis",
        synopsis: baseSynopsis,
      };
      if (stage >= 1) clue.decade = decade;
      if (stage >= 2) clue.primaryGenre = primaryGenre;
      if (stage >= 3) clue.director = primaryDirector;
      return clue;
    }

    case "cast": {
      const clue: SafeClue = {
        mode: "cast",
        director: primaryDirector,
      };
      const castNames = movie.cast_members.map(c => c.name);
      if (stage >= 1) clue.cast = castNames.slice(0, 1);
      if (stage >= 2) clue.cast = castNames.slice(0, 2);
      if (stage >= 3) {
        clue.cast = castNames.slice(0, 3);
        clue.releaseYear = movie.release_year;
      }
      return clue;
    }

    case "genre": {
      const clue: SafeClue = {
        mode: "genre",
        genres: movie.genres.slice(0, 3),
        decade,
      };
      if (stage >= 1) clue.originalLanguage = movie.original_language;
      if (stage >= 2) clue.director = primaryDirector;
      if (stage >= 3) {
        clue.leadActor = movie.cast_members[0]?.name;
        clue.releaseYear = movie.release_year;
      }
      return clue;
    }
  }
}
