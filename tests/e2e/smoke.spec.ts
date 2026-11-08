import { expect, test } from "@playwright/test";

test("smoke test - homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/ReelClue/);
  await expect(page.getByRole("heading", { name: "ReelClue", level: 1 })).toBeVisible();
});
