import Link from "next/link";
import {
  BarChart3,
  Database,
  ExternalLink,
  Film,
  HelpCircle,
  Play,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

/**
 * Official TMDB Short Logo (pill + TMDB letters).
 * Proportions (273.42 x 35.52) and gradient stops (#90cea1 -> #3cbec9 -> #00b3e5)
 * match official The Movie Database brand assets.
 */
function TmdbLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 273.42 35.52"
      aria-label="The Movie Database (TMDB) logo"
      role="img"
      className={className}
    >
      <defs>
        <linearGradient
          id="tmdb-brand-gradient"
          y1="17.76"
          x2="273.42"
          y2="17.76"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#90cea1" />
          <stop offset="0.56" stopColor="#3cbec9" />
          <stop offset="1" stopColor="#00b3e5" />
        </linearGradient>
      </defs>
      <g>
        <path
          fill="url(#tmdb-brand-gradient)"
          d="M191.85,35.37h63.9A17.67,17.67,0,0,0,273.42,17.7h0A17.67,17.67,0,0,0,255.75,0h-63.9A17.67,17.67,0,0,0,174.18,17.7h0A17.67,17.67,0,0,0,191.85,35.37ZM10.1,35.42h7.8V6.92H28V0H0v6.9H10.1Zm28.1,0H46V8.25h.1L55.05,35.4h6L70.3,8.25h.1V35.4h7.8V0H66.45l-8.2,23.1h-.1L50,0H38.2ZM89.14.12h11.7a33.56,33.56,0,0,1,8.08,1,18.52,18.52,0,0,1,6.67,3.08,15.09,15.09,0,0,1,4.53,5.52,18.5,18.5,0,0,1,1.67,8.25,16.91,16.91,0,0,1-1.62,7.58,16.3,16.3,0,0,1-4.38,5.5,19.24,19.24,0,0,1-6.35,3.37,24.53,24.53,0,0,1-7.55,1.15H89.14Zm7.8,28.2h4a21.66,21.66,0,0,0,5-.55A10.58,10.58,0,0,0,110,26a8.73,8.73,0,0,0,2.68-3.35,11.9,11.9,0,0,0,1-5.08,9.87,9.87,0,0,0-1-4.52,9.17,9.17,0,0,0-2.63-3.18A11.61,11.61,0,0,0,106.22,8a17.06,17.06,0,0,0-4.68-.63h-4.6ZM133.09.12h13.2a32.87,32.87,0,0,1,4.63.33,12.66,12.66,0,0,1,4.17,1.3,7.94,7.94,0,0,1,3,2.72,8.34,8.34,0,0,1,1.15,4.65,7.48,7.48,0,0,1-1.67,5,9.13,9.13,0,0,1-4.43,2.82V17a10.28,10.28,0,0,1,3.18,1,8.51,8.51,0,0,1,2.45,1.85,7.79,7.79,0,0,1,1.57,2.62,9.16,9.16,0,0,1,.55,3.2,8.52,8.52,0,0,1-1.2,4.68,9.32,9.32,0,0,1-3.1,3A13.38,13.38,0,0,1,152.32,35a22.5,22.5,0,0,1-4.73.5h-14.5Zm7.8,14.15h5.65a7.65,7.65,0,0,0,1.78-.2,4.78,4.78,0,0,0,1.57-.65,3.43,3.43,0,0,0,1.13-1.2,3.63,3.63,0,0,0,.42-1.8A3.3,3.3,0,0,0,151,8.6a3.42,3.42,0,0,0-1.23-1.13A6.07,6.07,0,0,0,148,6.9a9.9,9.9,0,0,0-1.85-.18h-5.3Zm0,14.65h7a8.27,8.27,0,0,0,1.83-.2,4.67,4.67,0,0,0,1.67-.7,3.93,3.93,0,0,0,1.23-1.3,3.8,3.8,0,0,0,.47-1.95,3.16,3.16,0,0,0-.62-2,4,4,0,0,0-1.58-1.18,8.23,8.23,0,0,0-2-.55,15.12,15.12,0,0,0-2.05-.15h-5.9Z"
        />
      </g>
    </svg>
  );
}

export function AboutView() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Top Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-280 items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Film aria-hidden="true" className="size-6" />
            <span>ReelClue</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/stats"
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <BarChart3 aria-hidden="true" className="size-4" />
              <span>Stats</span>
            </Link>
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Play aria-hidden="true" className="size-4 fill-current" />
              <span>Play Now</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-280 px-4 py-10 pb-[max(3rem,env(safe-area-inset-bottom))]">
        <article className="mx-auto max-w-3xl space-y-10">
          {/* Hero */}
          <section aria-labelledby="about-heading" className="space-y-3 border-b border-border/50 pb-8">
            <p className="font-semibold text-primary text-sm tracking-wide">About the Game</p>
            <h1 id="about-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">
              About ReelClue
            </h1>
            <p className="text-lg leading-relaxed text-muted-foreground">
              ReelClue is a mobile-first movie guessing playground designed for cinema lovers. Ten rounds of genuine film trivia with six distinct clue modes and progressive hints. Pure deduction without timers, user accounts, paywalls, or artificial fluff.
            </p>
          </section>

          {/* Section 1: TMDB Attribution & Non-Endorsement */}
          <section aria-labelledby="tmdb-attribution-heading" className="rounded-xl border border-input bg-card p-6 space-y-5 sm:p-8">
            <div className="flex items-center gap-3">
              <Database aria-hidden="true" className="size-6 text-primary shrink-0" />
              <h2 id="tmdb-attribution-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                The Movie Database (TMDB) Attribution
              </h2>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                ReelClue relies on movie catalog metadata provided by <strong className="text-foreground">The Movie Database (TMDB)</strong>, including film titles, synopsis summaries, director credits, cast ensembles, release dates, and promotional posters.
              </p>

              {/* Subordinate TMDB logo display */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-border/60 bg-background/60 p-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Data & Image Provider
                  </p>
                  <TmdbLogo className="h-6 w-auto max-w-36" />
                </div>
                <a
                  href="https://www.themoviedb.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-md text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <span>Visit The Movie Database</span>
                  <ExternalLink aria-hidden="true" className="size-4" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </div>

              {/* Mandatory Non-Endorsement Notice */}
              <blockquote className="border-l-4 border-primary/70 bg-secondary/50 p-4 rounded-r-md text-foreground font-medium italic">
                “This product uses the TMDB API but is not endorsed or certified by TMDB.”
              </blockquote>

              <p className="text-xs text-muted-foreground">
                All catalog data is ingested through server-only connections. Client browsers never receive TMDB API credentials or write privileges.
              </p>
            </div>
          </section>

          {/* Section 2: Movie Familiarity & TMDB Metrics */}
          <section aria-labelledby="familiarity-metrics-heading" className="rounded-xl border border-input bg-card p-6 space-y-4 sm:p-8">
            <div className="flex items-center gap-3">
              <Film aria-hidden="true" className="size-6 text-primary shrink-0" />
              <h2 id="familiarity-metrics-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Movie Familiarity & What Metrics Mean
              </h2>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                ReelClue calibrates movies into three familiarity tiers: <span className="font-semibold text-foreground">Easy</span>, <span className="font-semibold text-foreground">Medium</span>, and <span className="font-semibold text-foreground">Hard</span>.
              </p>

              <div className="grid gap-3 pt-1 sm:grid-cols-3">
                <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-1">
                  <h3 className="font-semibold text-foreground">Easy</h3>
                  <p className="text-xs text-muted-foreground">
                    Widely celebrated blockbusters, pop-culture landmarks, and household classics.
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-1">
                  <h3 className="font-semibold text-foreground">Medium</h3>
                  <p className="text-xs text-muted-foreground">
                    Established favorites and popular genre cinema rewarding regular moviegoers.
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-background/40 p-4 space-y-1">
                  <h3 className="font-semibold text-foreground">Hard</h3>
                  <p className="text-xs text-muted-foreground">
                    Well-regarded hidden gems and critically acclaimed titles with proven audiences.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-border/40 text-xs sm:text-sm">
                <p>
                  <strong className="text-foreground">What TMDB popularity means:</strong> TMDB popularity is a dynamic user-engagement score influenced by search volume, watchlist additions, reviews, and recent trending activity. It does <strong className="text-foreground">not</strong> measure box-office receipts, streaming hours, or total global viewers.
                </p>
                <p>
                  <strong className="text-foreground">Familiarity as a practical proxy:</strong> Total global vote count is used as a pragmatic approximation of familiarity. The Hard tier requires at least 500 global TMDB votes to guarantee a real audience.
                </p>
                <p>
                  <strong className="text-foreground">Objective quality disclaimer:</strong> The Hard label represents audience recognizability, <strong className="text-foreground">not an empirical claim that a movie is objectively underrated</strong>, overlooked, or superior to mainstream films. We never lower the 500-vote threshold to fill games with random obscurity.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: Clues, Synopses & Spoiler Advisory */}
          <section aria-labelledby="spoilers-heading" className="rounded-xl border border-input bg-card p-6 space-y-4 sm:p-8">
            <div className="flex items-center gap-3">
              <HelpCircle aria-hidden="true" className="size-6 text-primary shrink-0" />
              <h2 id="spoilers-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Clues & Spoilers
              </h2>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                All clues—synopses, missing titles, director and cast lineups, and genre tags—are derived directly from verified catalog data. No synthetic or AI-invented movie facts are used.
              </p>
              <p>
                To provide fair deduction, canonical titles and aliases are programmatically masked with <code className="rounded bg-secondary px-1.5 py-0.5 font-mono text-xs text-foreground">[movie]</code> boundaries.
              </p>
              <div className="rounded-lg border border-border/50 bg-secondary/30 p-4 text-xs sm:text-sm space-y-1">
                <p className="font-semibold text-foreground">Spoiler Advisory</p>
                <p className="text-muted-foreground">
                  Because clues present genuine movie synopses and character details, some hints describe inciting incidents, character relationships, or premises. If you prefer entering films with zero prior knowledge, please note that guessing rounds can reveal premise elements.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4: Privacy, Cookies & Data Lifecycle */}
          <section aria-labelledby="privacy-heading" className="rounded-xl border border-input bg-card p-6 space-y-4 sm:p-8">
            <div className="flex items-center gap-3">
              <ShieldCheck aria-hidden="true" className="size-6 text-primary shrink-0" />
              <h2 id="privacy-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Privacy, Cookies & Data Retention
              </h2>
            </div>

            <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
              <p>
                ReelClue is built with privacy-by-default architecture. We do not collect your name, email, phone number, location, or social login.
              </p>

              <div className="space-y-3">
                <div className="border-l-2 border-border/80 pl-3 space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">Anonymous Player Identity</h3>
                  <p className="text-xs sm:text-sm">
                    Starting a game sets an anonymous 256-bit cryptographic token in an <code className="rounded bg-secondary px-1 py-0.5 text-xs text-foreground">HttpOnly</code>, <code className="rounded bg-secondary px-1 py-0.5 text-xs text-foreground">SameSite=Lax</code>, <code className="rounded bg-secondary px-1 py-0.5 text-xs text-foreground">Secure</code> cookie named <code className="rounded bg-secondary px-1 py-0.5 text-xs text-foreground">reelclue_player</code> (30-day lifetime). On our database, only a one-way SHA-256 hash is saved. It links active game sessions to your current browser without any personal account.
                  </p>
                </div>

                <div className="border-l-2 border-border/80 pl-3 space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">Per-Device Browser Storage</h3>
                  <p className="text-xs sm:text-sm">
                    Gameplay history, streaks, and preferences (such as selected difficulty or clue mode) reside exclusively inside your device&apos;s <code className="rounded bg-secondary px-1 py-0.5 text-xs text-foreground">localStorage</code>. They are never synced to a remote cloud or shared. You can delete them at any time by pressing <strong>Clear History</strong> on the <Link href="/stats" className="text-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Statistics</Link> page.
                  </p>
                </div>

                <div className="border-l-2 border-border/80 pl-3 space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">Automatic Server Purge Schedules</h3>
                  <ul className="list-disc pl-5 text-xs sm:text-sm space-y-1">
                    <li>Free-text guesses and round action attempts: purged automatically after 7 days.</li>
                    <li>Incomplete sessions: expire at 24 hours, purged after 7 days.</li>
                    <li>Completed game results snapshots: purged after 30 days.</li>
                    <li>Anonymous player tokens: expire after 30 days.</li>
                  </ul>
                </div>

                <div className="border-l-2 border-border/80 pl-3 space-y-1">
                  <h3 className="font-semibold text-foreground text-sm">Zero Commercial Tracking</h3>
                  <p className="text-xs sm:text-sm">
                    We do not load third-party ad networks, tracking pixels, or cross-site behavioral telemetry.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 5: Non-Commercial Scope & Intellectual Property */}
          <section aria-labelledby="scope-heading" className="rounded-xl border border-input bg-card p-6 space-y-4 sm:p-8">
            <div className="flex items-center gap-3">
              <Sparkles aria-hidden="true" className="size-6 text-primary shrink-0" />
              <h2 id="scope-heading" className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Non-Commercial Scope & Legal Notice
              </h2>
            </div>

            <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
              <p>
                ReelClue is an independent, non-commercial trivia project created for entertainment and educational exploration. It does not sell products, serve advertisements, charge subscription fees, or monetize user activity.
              </p>
              <p>
                All motion picture titles, poster images, taglines, stills, character names, and trade names referenced in the game are trademarks and copyright of their respective copyright owners and studios. Their inclusion in this trivia context constitutes fair use for commentary and educational quiz purposes.
              </p>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-280 space-y-3 px-4">
          <div className="flex justify-center gap-6 text-sm text-foreground">
            <Link
              href="/"
              className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Home
            </Link>
            <Link
              href="/play"
              className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Play
            </Link>
            <Link
              href="/stats"
              className="hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Statistics
            </Link>
            <Link
              href="/about"
              className="font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              About
            </Link>
          </div>
          <p>ReelClue — A mobile-first movie guessing playground.</p>
          <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
        </div>
      </footer>
    </div>
  );
}
