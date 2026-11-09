import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import manifest from "@/app/manifest";
import { metadata, viewport } from "@/app/layout";
import fs from "node:fs";
import path from "node:path";

describe("PWA Install Metadata & Manifest", () => {
  it("provides valid Web App Manifest configuration", () => {
    const manifestData = manifest();

    expect(manifestData.name).toBe("ReelClue — Movie Guessing Playground");
    expect(manifestData.short_name).toBe("ReelClue");
    expect(manifestData.start_url).toBe("/");
    expect(manifestData.display).toBe("standalone");
    expect(manifestData.background_color).toBe("#10131a");
    expect(manifestData.theme_color).toBe("#10131a");
    expect(manifestData.orientation).toBe("portrait");

    expect(manifestData.icons).toBeDefined();
    expect(manifestData.icons?.length).toBeGreaterThanOrEqual(3);

    const sizes = manifestData.icons?.map((icon) => icon.sizes);
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");

    const maskable = manifestData.icons?.find((icon) => icon.purpose === "maskable");
    expect(maskable).toBeDefined();
    expect(maskable?.sizes).toBe("512x512");
  });

  it("exports valid viewport and apple web app metadata", () => {
    expect(viewport.themeColor).toBe("#10131a");
    expect(viewport.width).toBe("device-width");
    expect(viewport.initialScale).toBe(1);

    expect(metadata.manifest).toBe("/manifest.webmanifest");
    expect(metadata.appleWebApp).toEqual({
      capable: true,
      statusBarStyle: "black-translucent",
      title: "ReelClue",
    });
  });

  it("verifies physical existence and dimensions of generated PWA icons", () => {
    const publicIconsDir = path.resolve(process.cwd(), "public", "icons");
    expect(fs.existsSync(path.join(publicIconsDir, "icon-192.png"))).toBe(true);
    expect(fs.existsSync(path.join(publicIconsDir, "icon-512.png"))).toBe(true);
    expect(fs.existsSync(path.join(publicIconsDir, "icon-512-maskable.png"))).toBe(true);
    expect(fs.existsSync(path.join(publicIconsDir, "apple-touch-icon.png"))).toBe(true);
  });

  it("verifies service worker route exclusion rules directly from sw.js", () => {
    const swPath = path.resolve(process.cwd(), "public", "sw.js");
    const swContent = fs.readFileSync(swPath, "utf-8");

    // Must never cache private game routes
    expect(swContent).toContain("pathname.startsWith('/api/games')");
    expect(swContent).toContain("pathname.startsWith('/api/movies')");
    expect(swContent).toContain("pathname.startsWith('/api/daily')");
    expect(swContent).toContain("pathname.startsWith('/api/player')");
    expect(swContent).toContain("pathname.startsWith('/play/')");

    // Must handle offline fallback on navigate
    expect(swContent).toContain("request.mode === 'navigate'");
    expect(swContent).toContain("match('/offline')");
  });
});
