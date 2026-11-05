import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AboutView } from "../../src/features/about/about-view";

describe("AboutView component (RC-021)", () => {
  it("renders page header and navigation links", () => {
    render(<AboutView />);

    expect(screen.getByRole("heading", { level: 1, name: "About ReelClue" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ReelClue" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Stats" })).toHaveAttribute("href", "/stats");
    expect(screen.getByRole("link", { name: "Play Now" })).toHaveAttribute("href", "/play");
  });

  it("displays TMDB attribution with approved logo, required notice, and accessible external link", () => {
    render(<AboutView />);

    // Heading
    expect(
      screen.getByRole("heading", { level: 2, name: "The Movie Database (TMDB) Attribution" })
    ).toBeInTheDocument();

    // TMDB Logo
    const logo = screen.getByRole("img", { name: "The Movie Database (TMDB) logo" });
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute("viewBox", "0 0 273.42 35.52");

    // Exact required non-endorsement notice
    const notices = screen.getAllByText(
      /This product uses the TMDB API but is not endorsed or certified by TMDB\./
    );
    expect(notices.length).toBeGreaterThanOrEqual(1);
    expect(notices[0].tagName.toLowerCase()).toBe("blockquote");

    // Accessible external link with target blank and noopener noreferrer
    const tmdbLink = screen.getByRole("link", { name: /Visit The Movie Database/i });
    expect(tmdbLink).toHaveAttribute("href", "https://www.themoviedb.org");
    expect(tmdbLink).toHaveAttribute("target", "_blank");
    expect(tmdbLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByText("(opens in a new tab)")).toBeInTheDocument();
  });

  it("accurately explains movie familiarity proxies without claims of box office or underrated status", () => {
    render(<AboutView />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Movie Familiarity & What Metrics Mean" })
    ).toBeInTheDocument();

    // Tiers
    expect(screen.getByRole("heading", { level: 3, name: "Easy" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Medium" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Hard" })).toBeInTheDocument();

    // TMDB popularity definition
    expect(screen.getByText(/What TMDB popularity means:/)).toBeInTheDocument();
    expect(screen.getByText(/box-office receipts, streaming hours, or total global viewers/i)).toBeInTheDocument();

    // Hard tier disclaimer
    expect(screen.getByText(/Objective quality disclaimer:/)).toBeInTheDocument();
    expect(
      screen.getByText(/not an empirical claim that a movie is objectively underrated/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/at least 500 global TMDB votes/i)).toBeInTheDocument();
  });

  it("explains clue redactions and spoiler expectations honestly", () => {
    render(<AboutView />);

    expect(screen.getByRole("heading", { level: 2, name: "Clues & Spoilers" })).toBeInTheDocument();
    expect(screen.getByText(/masked with/)).toBeInTheDocument();
    expect(screen.getByText(/\[movie\]/)).toBeInTheDocument();
    expect(screen.getByText(/Spoiler Advisory/)).toBeInTheDocument();
    expect(
      screen.getByText(/guessing rounds can reveal premise elements/i)
    ).toBeInTheDocument();
  });

  it("transparently details anonymous privacy, cookies, localStorage, and database retention", () => {
    render(<AboutView />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Privacy, Cookies & Data Retention" })
    ).toBeInTheDocument();

    // Cookie details
    expect(screen.getByText("Anonymous Player Identity")).toBeInTheDocument();
    expect(screen.getByText(/reelclue_player/)).toBeInTheDocument();
    expect(screen.getByText(/HttpOnly/)).toBeInTheDocument();
    expect(screen.getByText(/one-way SHA-256 hash/)).toBeInTheDocument();

    // Local storage details
    expect(screen.getByText("Per-Device Browser Storage")).toBeInTheDocument();
    expect(screen.getByText(/localStorage/)).toBeInTheDocument();
    const statsLinks = screen.getAllByRole("link", { name: "Statistics" });
    expect(statsLinks[0]).toHaveAttribute("href", "/stats");

    // Purge schedule
    expect(screen.getByText("Automatic Server Purge Schedules")).toBeInTheDocument();
    expect(screen.getByText(/purged automatically after 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/expire at 24 hours, purged after 7 days/i)).toBeInTheDocument();
    expect(screen.getByText(/results snapshots: purged after 30 days/i)).toBeInTheDocument();
    expect(screen.getByText(/tokens: expire after 30 days/i)).toBeInTheDocument();

    // No trackers
    expect(screen.getByText("Zero Commercial Tracking")).toBeInTheDocument();
  });

  it("states non-commercial playground status and intellectual property acknowledgment", () => {
    render(<AboutView />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Non-Commercial Scope & Legal Notice" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/non-commercial trivia project created for entertainment and educational exploration/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/trademarks and copyright of their respective copyright owners/i)
    ).toBeInTheDocument();
  });

  it("renders footer with navigation links and TMDB notice", () => {
    render(<AboutView />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Play" })).toHaveAttribute("href", "/play");
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
  });
});
