import { expect, test } from "@playwright/test";
import { installGameFixture, levels, modes, skipAndAdvance, startGame } from "./fixtures";

for (const mode of modes) {
  for (const level of levels) {
    test(`${mode} / ${level} completes ten fixture-scored rounds`, async ({ page }) => {
      const fixture = installGameFixture(page);
      await startGame(page, mode, level);
      expect(fixture.current().mode).toBe(mode);
      expect(fixture.current().level).toBe(level);
      for (let round = 1; round <= 10; round++) {
        if (mode === "mixed") expect(fixture.current().active_round.mode).toBe(modes[(round - 1) % 5]);
        if (round === 1) {
          const input = page.getByRole("combobox", { name: "Movie title" });
          await input.fill("Fictional Lantern");
          await input.press("Escape");
          await input.blur();
          await page.getByRole("button", { name: "Submit Guess" }).click();
          await expect(page.getByRole("heading", { name: "Correct answer!" })).toBeVisible();
          expect(fixture.current().score).toBe({ easy: 100, medium: 150, hard: 200 }[level]);
          await page.getByRole("button", { name: /Next Round/ }).click();
        } else {
          await skipAndAdvance(page, round === 10);
        }
        if (round < 10) await expect(page.getByText(`${round + 1}/10`)).toBeVisible();
      }
      await expect(page).toHaveURL(new RegExp(`/results/${fixture.current().id}$`), { timeout: 20000 });
      expect(fixture.current().score).toBe({ easy: 100, medium: 150, hard: 200 }[level]);
      expect(fixture.current().completed_rounds).toHaveLength(9);
    });
  }
}
