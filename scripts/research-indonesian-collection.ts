import { parseTmdbEnv } from "../src/lib/server/tmdb/config.ts";

async function measureIndonesianMovies() {
  const auth = parseTmdbEnv(process.env);
  const token = auth.token;
  const key = auth.key;

  async function queryDiscover(params: Record<string, string>) {
    const url = new URL("https://api.themoviedb.org/3/discover/movie");
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
    if (key) url.searchParams.set("api_key", key);

    const res = await fetch(url.toString(), {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Discover failed: ${res.status} ${res.statusText}`);
    }

    return res.json();
  }

  console.log("=== Querying TMDB for Indonesian Movies (original_language=id) ===");

  const thresholds = [500, 200, 100, 50, 20, 10, 0];
  const counts: Record<number, number> = {};

  for (const minVotes of thresholds) {
    const data = await queryDiscover({
      include_adult: "false",
      include_video: "false",
      with_original_language: "id",
      "vote_count.gte": String(minVotes),
      sort_by: "vote_count.desc",
      page: "1",
    });
    counts[minVotes] = data.total_results;
  }

  console.log("\n--- Real Candidate Counts by TMDB Vote Floor ---");
  for (const [thresh, total] of Object.entries(counts)) {
    console.log(`vote_count >= ${thresh.padStart(4, " ")}: ${total} movies`);
  }

  // Fetch top 30 Indonesian movies by vote_count
  const topData = await queryDiscover({
    include_adult: "false",
    include_video: "false",
    with_original_language: "id",
    sort_by: "vote_count.desc",
    page: "1",
  });

  const page2Data = await queryDiscover({
    include_adult: "false",
    include_video: "false",
    with_original_language: "id",
    sort_by: "vote_count.desc",
    page: "2",
  });

  const allTop = [...topData.results, ...page2Data.results].slice(0, 30);

  console.log("\n--- Top 30 Indonesian Movies by Global TMDB Vote Count ---");
  for (const m of allTop) {
    const year = m.release_date ? m.release_date.slice(0, 4) : "????";
    console.log(
      `- [${m.id}] "${m.title}" (Original: "${m.original_title}", ${year}) — Votes: ${m.vote_count}, Rating: ${m.vote_average}, Pop: ${m.popularity}`
    );
  }

  // Also query origin_country=ID (in case original_language != 'id' e.g. co-productions)
  const countryData = await queryDiscover({
    include_adult: "false",
    include_video: "false",
    with_origin_country: "ID",
    "vote_count.gte": "500",
    page: "1",
  });
  console.log(`\nMovies with with_origin_country=ID and vote_count >= 500: ${countryData.total_results}`);
}

measureIndonesianMovies().catch(err => {
  console.error("Measurement error:", err);
  process.exit(1);
});
