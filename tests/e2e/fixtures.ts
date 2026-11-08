import { expect, type Page } from "@playwright/test";

// Fictional browser-only API fixture. No TMDB requests or production DB writes.
export const modes = ["poster", "title", "synopsis", "cast", "genre", "mixed"] as const;
export const levels = ["easy", "medium", "hard"] as const;
export const sessionId = "00000000-0000-4000-8000-000000000001";
const roundId = (ordinal: number) => `00000000-0000-4000-8000-${String(ordinal).padStart(12, "0")}`;
const title = "Fictional Lantern";
const movieId = 901234;

export function installGameFixture(page: Page) {
  let session: ReturnType<typeof snapshot>;
  let mode: typeof modes[number] = "poster";
  let level: typeof levels[number] = "easy";
  let revision = 0;
  let ordinal = 1;
  let stage = 0;
  let misses = 0;
  let state: "guessing" | "correct" | "skipped" | "exhausted" = "guessing";
  let score = 0;
  let completed = false;
  const roundScore = () => state === "correct" ? Math.max(0, ({ easy: 100, medium: 150, hard: 200 })[level] - stage * 20 - misses * 25) : 0;
  let retryLostResponse = false;
  let expire = false;
  const actions = new Map<string, { payload: string; result: unknown }>();
  const history: Array<{ ordinal: number; mode: string; reveal: ReturnType<typeof reveal> }> = [];

  const roundMode = () => mode === "mixed" ? modes[(ordinal - 1) % 5] : mode;
  const reveal = () => ({ tmdb_id: movieId + ordinal, title, original_title: title, release_year: 2000, genres: ["Fictional"], directors: ["Fictional Director"], cast: ["Fictional Actor"], synopsis: "Fictional fixture synopsis.", poster_path: null, outcome: state, score: roundScore(), hints_used: stage, wrong_attempts: misses });
  const clue = () => {
    const current = roundMode();
    if (current === "poster") return { mode: current, posterUrl: `/api/games/${sessionId}/rounds/${roundId(ordinal)}/poster?stage=${stage}` };
    if (current === "title") return { mode: current, maskedTitle: "F_c_i_n_l L_n_e_n" };
    if (current === "synopsis") return { mode: current, synopsis: "A fictional story about a lantern and a secret journey through a made-up town. No real movie facts are used in this fixture." };
    if (current === "cast") return { mode: current, director: "Fictional Director", cast: stage ? ["Fictional Actor"] : [] };
    return { mode: current, genres: ["Fictional"], decade: "2000s" };
  };
  function snapshot() {
    return { id: sessionId, mode, level, state: completed ? "completed" as const : "active" as const, current_round: ordinal, score, revision, active_round: { id: roundId(ordinal), ordinal, mode: roundMode(), hint_stage: stage, wrong_attempts: misses, state, score: roundScore(), clue: clue(), reveal: state === "guessing" ? null : reveal() }, completed_rounds: history.map(({ ordinal, reveal }) => ({ ordinal, reveal })) };
  }
  session = snapshot();
  const send = (body: unknown, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
  const error = (code: string, status: number) => send({ error: { code, message: code, retryable: status >= 500 } }, status);
  const update = () => { revision++; session = snapshot(); return session; };

  page.route("**/api/player", route => route.fulfill(send({ ok: true }, 201)));
  page.route("**/api/movies/search?*", route => route.fulfill(send({ items: [{ title, releaseYear: 2000, choiceHandle: "fictional-handle" }] })));
  page.route("**/api/games/**/poster?*", route => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/qAAAAABJRU5ErkJggg==", "base64") }));
  page.route("**/api/games", async route => {
    const body = route.request().postDataJSON();
    if (!modes.includes(body.mode) || !levels.includes(body.difficulty)) return route.fulfill(error("VALIDATION_ERROR", 400));
    mode = body.mode;
    level = body.difficulty;
    ordinal = 1; revision = 0; score = 0; stage = 0; misses = 0; completed = false; state = "guessing"; history.length = 0; actions.clear(); session = snapshot();
    await route.fulfill(send(session, 201));
  });
  page.route("**/api/games/*", route => route.fulfill(expire ? error("SESSION_EXPIRED", 410) : send(session)));
  page.route("**/api/games/*/results", route => route.fulfill(send({ id: sessionId, mode, level, state: "completed", score, max_score: 1000, accuracy: 0, correct_count: 0, total_rounds: 10, total_hints_used: 0, total_wrong_attempts: 0, completed_at: new Date().toISOString(), rounds: [...history, { ordinal, mode: roundMode(), reveal: reveal() }] })));
  for (const action of ["guess", "hint", "skip", "next"] as const) {
    page.route(`**/api/games/*/${action}`, async route => {
      const body = route.request().postDataJSON();
      const key = `${action}:${body.actionId}`;
      const payload = JSON.stringify(body);
      const previous = actions.get(key);
      if (previous) return route.fulfill(previous.payload === payload ? send(previous.result) : error("ACTION_ID_COLLISION", 409));
      if (body.revision !== revision || body.roundId !== roundId(ordinal)) return route.fulfill(error("REVISION_MISMATCH", 409));
      if (action === "hint") { if (state !== "guessing" || stage === 3) return route.fulfill(error("HINT_LIMIT", 409)); stage++; }
      if (action === "skip") { if (state !== "guessing") return route.fulfill(error("ROUND_FINISHED", 409)); state = "skipped"; }
      if (action === "guess") {
        if (state !== "guessing") return route.fulfill(error("ROUND_FINISHED", 409));
        if (body.answerText === title || body.choiceHandle === "fictional-handle") { state = "correct"; score += roundScore(); }
        else { misses++; if (misses === 3) state = "exhausted"; }
      }
      if (action === "next") { if (state === "guessing") return route.fulfill(error("ROUND_NOT_FINISHED", 409)); if (ordinal < 10) { history.push({ ordinal, mode: roundMode(), reveal: reveal() }); ordinal++; stage = 0; misses = 0; state = "guessing"; } else completed = true; }
      const result = update();
      const response = action === "guess" ? { outcome: state === "correct" ? "correct" : "wrong", is_duplicate: false, points: state === "correct" ? result.active_round.score : 0, wrong_attempts: misses, session: result } : result;
      actions.set(key, { payload, result: response });
      if (retryLostResponse) { retryLostResponse = false; return route.abort("failed"); }
      await route.fulfill(send(response));
    });
  }
  return {
    current: () => session,
    expire: () => { expire = true; },
    loseNextResponse: () => { retryLostResponse = true; },
  };
}

export async function startGame(page: Page, mode: typeof modes[number], level: typeof levels[number]) {
  await page.goto("/play");
  const modeLabel = { poster: "Poster Blur", title: "Missing Title", synopsis: "Synopsis", cast: "Director & Cast", genre: "Genre Detective", mixed: "Mixed" }[mode];
  await page.getByText(modeLabel, { exact: true }).click();
  await page.getByText(level[0].toUpperCase() + level.slice(1), { exact: true }).click();
  await page.getByRole("button", { name: "Start Game" }).click();
  await expect(page).toHaveURL(new RegExp(`/play/${sessionId}$`), { timeout: 20000 });
  await expect(page.getByText("1/10")).toBeVisible();
}

export async function skipAndAdvance(page: Page, last = false) {
  await page.getByRole("button", { name: "Skip Round" }).click();
  await page.getByRole("button", { name: /Confirm Skip/ }).click();
  await expect(page.getByRole("heading", { name: "Round skipped" })).toBeVisible();
  await page.getByRole("button", { name: last ? /Finish Game & View Results/ : /Next Round/ }).click();
}
