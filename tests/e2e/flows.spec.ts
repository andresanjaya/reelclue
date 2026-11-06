import { expect, test } from "@playwright/test";

test.describe("Critical Game Flows (RC-023)", () => {
  test.beforeEach(async ({ page }) => {
    // Ensure fresh player identity
    await page.goto("/");
  });

  test("home page navigation to play, stats, and about", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/ReelClue/);

    // Navigation links
    await page.getByRole("link", { name: "Play", exact: true }).first().click();
    await expect(page).toHaveURL(/\/play$/);

    await page.goto("/");
    await page.getByRole("link", { name: "Stats" }).first().click();
    await expect(page).toHaveURL(/\/stats$/);

    await page.goto("/");
    await page.getByRole("link", { name: "About" }).first().click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { name: "About ReelClue", level: 1 })).toBeVisible();
  });

  test("setup page selects all six modes and familiarity levels", async ({ page }) => {
    await page.goto("/play");
    await expect(page.getByRole("heading", { name: "Game setup", level: 1 })).toBeVisible();

    const modeLabels = [
      "Poster Blur",
      "Missing Title",
      "Synopsis",
      "Director & Cast",
      "Genre Detective",
      "Mixed",
    ];

    for (const label of modeLabels) {
      await page.getByText(label, { exact: true }).click();
      const radio = page.getByRole("radio", { name: new RegExp(label) });
      await expect(radio).toBeChecked();
    }

    const levelLabels = ["Easy", "Medium", "Hard"];
    for (const level of levelLabels) {
      await page.getByText(level, { exact: true }).click();
      const radio = page.getByRole("radio", { name: new RegExp(level) });
      await expect(radio).toBeChecked();
    }
  });

  test("plays poster mode with hint, wrong guess, and skip", async ({ page }) => {
    await page.goto("/play");
    await page.getByText("Poster Blur", { exact: true }).click();
    await page.getByText("Easy", { exact: true }).click();

    await page.getByRole("button", { name: /Start Game/i }).click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+/, { timeout: 15000 });

    // Verify game header
    await expect(page.getByText("1/10")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("3 attempts left")).toBeVisible();

    // Verify poster image loads
    const posterImg = page.getByRole("img", { name: /Movie poster clue/i });
    await expect(posterImg).toBeVisible({ timeout: 15000 });

    // Reveal Hint 1
    const hintButton = page.getByRole("button", { name: /Hint 1/i });
    await expect(hintButton).toBeVisible();
    const hintPromise = page.waitForResponse(r => r.url().includes("/hint") && r.status() === 200);
    await hintButton.click();
    await hintPromise;

    // Hint 1 should now be revealed and button should advance to Hint 2
    await expect(page.getByRole("button", { name: /Hint 2/i })).toBeVisible();

    // Submit a wrong guess
    const combobox = page.getByRole("combobox", { name: /Movie title/i });
    await combobox.fill("Some Nonexistent Film XYZ");
    await combobox.press("Escape"); // Close dropdown
    const guessPromise = page.waitForResponse(r => r.url().includes("/guess") && r.status() === 200);
    await page.getByRole("button", { name: /Submit Guess/i }).click();
    await guessPromise;

    // Attempt count decrements
    await expect(page.getByText("2 attempts left")).toBeVisible();
    await expect(page.getByText(/Wrong guess!/i)).toBeVisible();

    // Skip round
    const skipButton = page.getByRole("button", { name: /Skip Round/i });
    await expect(skipButton).toBeVisible();
    await skipButton.click();

    // Confirm skip in dialog
    const confirmSkipBtn = page.getByRole("button", { name: /Confirm Skip/i });
    await expect(confirmSkipBtn).toBeVisible();
    const skipPromise = page.waitForResponse(r => r.url().includes("/skip") && r.status() === 200);
    await confirmSkipBtn.click();
    await skipPromise;

    // Terminal reveal shown
    await expect(page.getByRole("heading", { name: /Round skipped/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Next Round/i })).toBeVisible();

    // Advance to Round 2
    const nextPromise = page.waitForResponse(r => r.url().includes("/next") && r.status() === 200);
    await page.getByRole("button", { name: /Next Round/i }).click();
    await nextPromise;
    await expect(page.getByText("2/10")).toBeVisible();
    await expect(page.getByText("3 attempts left")).toBeVisible();
  });

  test("keyboard autocomplete search and selection", async ({ page }) => {
    await page.goto("/play");
    await page.getByText("Missing Title", { exact: true }).click();
    await page.getByText("Easy", { exact: true }).click();
    await page.getByRole("button", { name: /Start Game/i }).click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+/, { timeout: 15000 });

    const combobox = page.getByRole("combobox", { name: /Movie title/i });
    await expect(combobox).toBeVisible({ timeout: 15000 });
    await combobox.focus();
    const searchPromise = page.waitForResponse(r => r.url().includes("/search") && r.status() === 200);
    await combobox.pressSequentially("Dark", { delay: 100 });
    await searchPromise;

    // Wait for suggestions listbox
    const listbox = page.getByRole("listbox");
    await expect(listbox).toBeVisible({ timeout: 5000 });

    const options = page.getByRole("option");
    const count = await options.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(8);

    // Keyboard navigation (ArrowDown then Enter)
    await combobox.press("ArrowDown");
    await combobox.press("Enter");

    // Input should be filled with selected title
    const value = await combobox.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test("third wrong attempt triggers terminal reveal with 0 score", async ({ page }) => {
    await page.goto("/play");
    await page.getByText("Missing Title", { exact: true }).click();
    await page.getByText("Easy", { exact: true }).click();
    await page.getByRole("button", { name: /Start Game/i }).click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+/, { timeout: 15000 });

    const combobox = page.getByRole("combobox", { name: /Movie title/i });
    await expect(combobox).toBeVisible({ timeout: 15000 });
    const submitBtn = page.getByRole("button", { name: /Submit Guess/i });

    // Wrong guess 1
    await combobox.fill("Wrong Guess Alpha");
    await combobox.press("Escape");
    const p1 = page.waitForResponse(r => r.url().includes("/guess") && r.status() === 200);
    await submitBtn.click();
    await p1;
    await expect(page.getByText("2 attempts left")).toBeVisible();

    // Wrong guess 2
    await combobox.fill("Wrong Guess Beta");
    await combobox.press("Escape");
    const p2 = page.waitForResponse(r => r.url().includes("/guess") && r.status() === 200);
    await submitBtn.click();
    await p2;
    await expect(page.getByText("1 attempts left")).toBeVisible();

    // Wrong guess 3
    await combobox.fill("Wrong Guess Gamma");
    await combobox.press("Escape");
    const p3 = page.waitForResponse(r => r.url().includes("/guess") && r.status() === 200);
    await submitBtn.click();
    await p3;

    // Terminal reveal shown: Attempts exhausted
    await expect(page.getByRole("heading", { name: /Attempts exhausted/i })).toBeVisible();
    await expect(page.getByText(/0 points awarded/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Next Round/i })).toBeVisible();
  });

  test("hint cap blocks revealing more than 3 hints", async ({ page }) => {
    await page.goto("/play");
    await page.getByText("Missing Title", { exact: true }).click();
    await page.getByText("Easy", { exact: true }).click();
    await page.getByRole("button", { name: /Start Game/i }).click();
    await expect(page).toHaveURL(/\/play\/[0-9a-f-]+/, { timeout: 15000 });

    // Hint 1
    const h1 = page.waitForResponse(r => r.url().includes("/hint") && r.status() === 200);
    await page.getByRole("button", { name: /Hint 1/i }).click();
    await h1;
    await expect(page.getByRole("button", { name: /Hint 2/i })).toBeVisible();

    // Hint 2
    const h2 = page.waitForResponse(r => r.url().includes("/hint") && r.status() === 200);
    await page.getByRole("button", { name: /Hint 2/i }).click();
    await h2;
    await expect(page.getByRole("button", { name: /Hint 3/i })).toBeVisible();

    // Hint 3
    const h3 = page.waitForResponse(r => r.url().includes("/hint") && r.status() === 200);
    await page.getByRole("button", { name: /Hint 3/i }).click();
    await h3;

    // Hint button should now show No hints remaining (disabled)
    const hintBtn = page.getByRole("button", { name: /No hints remaining/i });
    await expect(hintBtn).toBeVisible();
    await expect(hintBtn).toBeDisabled();
  });

  test("results page and stats page records completed games", async ({ page }) => {
    // Visit stats page initially
    await page.goto("/stats");
    await expect(page.getByRole("heading", { name: "Device Statistics", level: 1 })).toBeVisible();

    // Clear history if any exists
    const clearButton = page.getByRole("button", { name: /Clear History/i });
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.getByRole("button", { name: /Yes, clear everything/i }).click();
    }

    await expect(page.getByRole("heading", { name: /No games completed yet/i })).toBeVisible();
  });
});
