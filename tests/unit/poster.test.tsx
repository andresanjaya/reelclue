import sharp from "sharp";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { transformPoster } from "../../src/lib/server/game/poster";
import { buildSafeClue } from "../../src/lib/server/game/clues";
import { ClueRenderer } from "../../src/features/game/clue-renderer";

const source = () => sharp({ create: { width: 800, height: 800, channels: 3, background: "red" } })
  .composite([{ input: Buffer.from('<svg width="800" height="800"><rect x="240" y="100" width="320" height="600" fill="blue"/></svg>'), top: 0, left: 0 }])
  .png().toBuffer();

describe("poster pipeline", () => {
  it("returns transformed 300x450 bytes with stage-dependent blur and no original bytes", async () => {
    const original = await source();
    const fetcher = vi.fn(async () => new Response(new Uint8Array(original))) as unknown as typeof fetch;
    const first = await transformPoster("/poster.png", "revision", 991, 0, fetcher);
    const clearer = await transformPoster("/poster.png", "revision", 991, 2, fetcher);
    const third = await transformPoster("/poster.png", "revision", 991, 3, fetcher);
    expect((await sharp(first).metadata()).format).toBe("webp");
    expect((await sharp(first).metadata()).width).toBe(300);
    expect((await sharp(first).metadata()).height).toBe(450);
    expect(first.equals(original)).toBe(false);
    expect(first.equals(clearer)).toBe(false);
    expect(clearer.equals(third)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith("https://image.tmdb.org/t/p/w500/poster.png", expect.objectContaining({ redirect: "error", cache: "no-store" }));
  });

  it("rejects invalid source paths, oversize bytes, and excessive decoded pixels", async () => {
    const fetcher = vi.fn(async () => new Response(new Uint8Array(5 * 1024 * 1024 + 1))) as unknown as typeof fetch;
    await expect(transformPoster("https://evil.example/poster.jpg", "v", 992, 0, fetcher)).rejects.toThrow("Invalid poster request");
    expect(fetcher).not.toHaveBeenCalled();
    await expect(transformPoster("/huge.jpg", "v", 992, 0, fetcher)).rejects.toThrow("too large");
    const huge = await sharp({ create: { width: 5000, height: 5000, channels: 3, background: "red" } }).png().toBuffer();
    await expect(transformPoster("/pixels.png", "v", 992, 0, async () => new Response(new Uint8Array(huge)))).rejects.toThrow();
  });

  it("keeps poster URL opaque and retries image failure without mutation", () => {
    const clue = buildSafeClue("poster", 2, { tmdb_id: 42, title: "Hidden Answer", original_title: "Hidden Answer", release_year: 1999,
      original_language: "en", genres: ["Drama"], sanitized_synopsis: null, directors: [], cast_members: [], poster_path: "/secret.jpg" },
    "session", "round", "seed");
    expect(JSON.stringify(clue)).not.toMatch(/Hidden Answer|secret\.jpg|\/42/);
    expect(clue).toMatchObject({ posterUrl: "/api/games/session/rounds/round/poster?stage=2" });
    render(<ClueRenderer clue={clue} />);
    const image = screen.getByRole("img", { name: "Movie poster clue" });
    fireEvent.error(image);
    expect(screen.getByText(/Attempts and score stay unchanged/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry poster" }));
    expect(screen.getByRole("img", { name: "Movie poster clue" })).toHaveAttribute("src", expect.stringContaining("retry=1"));
  });
});
