import { expect, test } from "@playwright/test";
import { installGameFixture, startGame } from "./fixtures";

test("active round never leaks answer, aliases, future rounds or poster source", async ({ page }) => {
  const fixture = installGameFixture(page);
  const network: string[] = [];
  page.on("response", async response => {
    if (!response.url().includes("/api/games") || !response.headers()["content-type"]?.includes("application/json")) return;
    network.push(await response.text());
  });
  await startGame(page, "poster", "easy");
  const beforeReveal = fixture.current();
  expect(beforeReveal.active_round.reveal).toBeNull();
  for (const body of network) {
    const parsed = JSON.parse(body);
    expect(parsed.active_round?.reveal).toBeNull();
    expect(parsed).not.toHaveProperty("future_rounds");
    expect(body).not.toMatch(/alias(?:es)?|original_poster|poster_path|movie_id|movie_ids/i);
    expect(body).not.toContain("Fictional Lantern");
  }
  const html = await page.content();
  expect(html).not.toContain("Fictional Lantern");
  expect(html).not.toMatch(/alias(?:es)?|original_poster|poster_path|future_rounds/i);
  await page.getByRole("button", { name: "Skip Round" }).click();
  await page.getByRole("button", { name: /Confirm Skip/ }).click();
  await expect(page.getByRole("heading", { name: "Fictional Lantern" })).toBeVisible();
});

test("search returns opaque handle without unrevealed catalog fields", async ({ page }) => {
  installGameFixture(page);
  await startGame(page, "title", "easy");
  const input = page.getByRole("combobox", { name: "Movie title" });
  const response = page.waitForResponse(r => r.url().includes("/movies/search"));
  await input.fill("Fic");
  const result = await (await response).json();
  expect(result).toEqual({ items: [{ title: "Fictional Lantern", releaseYear: 2000, choiceHandle: "fictional-handle" }] });
  expect(JSON.stringify(result)).not.toMatch(/alias(?:es)?|poster_path|future_rounds/i);
});
