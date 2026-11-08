import { expect, test } from "@playwright/test";
import { installGameFixture, sessionId, startGame } from "./fixtures";

test("refresh resumes same round and hint stage", async ({ page }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "synopsis", "medium");
  await page.getByRole("button", { name: /Hint 1/ }).click();
  await expect(page.getByRole("button", { name: /Hint 2/ })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: /Hint 2/ })).toBeVisible();
  expect(fixture.current().active_round.hint_stage).toBe(1);
  expect(fixture.current().active_round.ordinal).toBe(1);
});

test("two tabs resolve stale revision via 409 resync", async ({ page, context }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "title", "easy");
  const second = await context.newPage();
  // Context-level route fixture shared across tabs through page route on each tab.
  await second.route("**/api/games/*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(fixture.current()) }));
  await second.goto(`/play/${sessionId}`);
  await expect(second.getByText("1/10")).toBeVisible();
  await page.getByRole("button", { name: /Hint 1/ }).click();
  await expect(page.getByRole("button", { name: /Hint 2/ })).toBeVisible();
  await second.route("**/api/games/*/hint", route => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: { code: "REVISION_MISMATCH" } }) }));
  await second.getByRole("button", { name: /Hint 1/ }).click();
  await expect(second.getByRole("button", { name: /Hint 2/ })).toBeVisible();
  await expect(second.getByText("Session state synced with server.")).toBeVisible();
});

test("retry sends same action ID and payload after lost response", async ({ page }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "title", "easy");
  const requests: string[] = [];
  page.on("request", request => { if (request.url().endsWith("/guess")) requests.push(request.postData() ?? ""); });
  const input = page.getByRole("combobox", { name: "Movie title" });
  await input.fill("Incorrect fictional title");
  await input.press("Escape");
  fixture.loseNextResponse();
  await page.getByRole("button", { name: "Submit Guess" }).click();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByText("2 attempts left")).toBeVisible();
  expect(requests).toHaveLength(2);
  expect(requests[1]).toBe(requests[0]);
  expect(fixture.current().active_round.wrong_attempts).toBe(1);
});

test("expired session returns 410 and offers new game", async ({ page }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "genre", "hard");
  fixture.expire();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Session Expired" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start New Game" })).toHaveAttribute("href", "/play");
});

test("unavailable localStorage still permits game creation and refresh", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get: () => { throw new DOMException("Blocked", "SecurityError"); } }));
  installGameFixture(page);
  await startGame(page, "cast", "easy");
  await page.reload();
  await expect(page.getByText("1/10")).toBeVisible();
});

test("third miss reveals answer and keeps score at zero", async ({ page }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "title", "medium");
  for (const guess of ["Wrong Alpha", "Wrong Beta", "Wrong Gamma"]) {
    const input = page.getByRole("combobox", { name: "Movie title" });
    await input.fill(guess);
    await input.press("Escape");
    await input.blur();
    const guessPromise = page.waitForResponse(r => r.url().includes("/guess") && r.status() === 200);
    await page.getByRole("button", { name: "Submit Guess" }).click();
    await guessPromise;
    if (guess !== "Wrong Gamma") await expect(page.getByText(guess === "Wrong Alpha" ? "2 attempts left" : "1 attempts left")).toBeVisible();
  }
  await expect(page.getByRole("heading", { name: "Attempts exhausted" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Fictional Lantern" })).toBeVisible();
  expect(fixture.current().score).toBe(0);
  expect(fixture.current().active_round.wrong_attempts).toBe(3);
});

test("three hints cap at stage 3", async ({ page }) => {
  const fixture = installGameFixture(page);
  await startGame(page, "title", "hard");
  for (let stage = 1; stage <= 3; stage++) {
    await page.getByRole("button", { name: new RegExp(`Hint ${stage}`) }).click();
    await expect(page.getByRole("button", { name: stage === 3 ? /No hints remaining/ : new RegExp(`Hint ${stage + 1}`) })).toBeVisible();
  }
  await expect(page.getByRole("button", { name: /No hints remaining/ })).toBeDisabled();
  expect(fixture.current().active_round.hint_stage).toBe(3);
});
