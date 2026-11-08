import { expect, test } from "@playwright/test";
import { installGameFixture, startGame } from "./fixtures";

for (const width of [320, 360, 390, 768, 1440]) {
  test(`setup and clue reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    installGameFixture(page);
    await startGame(page, "cast", "easy");
    await expect(page.getByRole("combobox", { name: "Movie title" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    for (const name of ["Movie title", "Submit Guess", "Skip Round"]) {
      const control = name === "Movie title" ? page.getByRole("combobox", { name }) : page.getByRole("button", { name });
      const box = await control.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
  });
}

test("keyboard focus order and visible focus state", async ({ page }) => {
  installGameFixture(page);
  await startGame(page, "title", "easy");
  const input = page.getByRole("combobox", { name: "Movie title" });
  await input.fill("Wrong fictional title");
  await input.press("Escape");
  await input.focus();
  await expect(input).toBeFocused();
  await input.press("Tab");
  await expect(page.getByRole("button", { name: "Submit Guess" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: /Hint 1/ })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Skip Round" })).toBeFocused();
  const focus = await page.evaluate(() => {
    const element = document.activeElement!;
    return { style: getComputedStyle(element).outlineStyle, width: getComputedStyle(element).outlineWidth };
  });
  expect(focus.style).not.toBe("none");
  expect(parseFloat(focus.width)).toBeGreaterThanOrEqual(2);
});

test("contrast tokens measured and reduced-motion disables transitions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/play");
  await page.waitForSelector("button");
  const measurements = await page.evaluate(() => {
    const styles = getComputedStyle(document.documentElement);
    const luminance = (hex: string) => {
      const rgb = hex.trim().slice(1).match(/../g)!.map(byte => parseInt(byte, 16) / 255);
      const linear = rgb.map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const contrast = (a: string, b: string) => {
      const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (lighter + 0.05) / (darker + 0.05);
    };
    const token = (name: string) => styles.getPropertyValue(`--${name}`);
    return {
      body: contrast(token("foreground"), token("background")),
      muted: contrast(token("muted-foreground"), token("card")),
      button: contrast(token("primary-foreground"), token("primary")),
      border: contrast(token("input"), token("card")),
      transition: getComputedStyle(document.querySelector("button")!).transitionDuration,
    };
  });
  expect(measurements.body).toBeGreaterThanOrEqual(4.5);
  expect(measurements.muted).toBeGreaterThanOrEqual(4.5);
  expect(measurements.button).toBeGreaterThanOrEqual(4.5);
  expect(measurements.border).toBeGreaterThanOrEqual(3);
  expect(measurements.transition).toBe("0s");
});
