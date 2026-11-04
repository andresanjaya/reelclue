import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "../../src/app/page";
import { parseEnv } from "../../src/lib/env";

describe("bootstrap", () => {
  it("renders an honest placeholder without nonfunctional game controls", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "ReelClue", level: 1 })).toBeVisible();
    expect(screen.getByText(/Gameplay is not available yet/)).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("starts without provider credentials and drops unknown fields", () => {
    expect(parseEnv({ TMDB_READ_ACCESS_TOKEN: "test-only" })).toEqual({
      APP_BASE_URL: "http://localhost:3000",
    });
  });

  it("accepts a configured HTTPS app URL", () => {
    expect(parseEnv({ APP_BASE_URL: "https://example.com" }).APP_BASE_URL).toBe("https://example.com");
  });

  it.each(["", "not-a-url", "ftp://example.com", "secret-invalid-value"])(
    "rejects invalid app URL without echoing input (%s)",
    (APP_BASE_URL) => {
      expect(() => parseEnv({ APP_BASE_URL })).toThrow(
        "Invalid server configuration: APP_BASE_URL must be an HTTP(S) URL.",
      );
    },
  );
});
