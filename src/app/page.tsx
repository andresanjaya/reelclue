import type { Metadata } from "next";
import Link from "next/link";
import { Film, HelpCircle, Lightbulb, Play, Trophy } from "lucide-react";
import { modes } from "@/features/game/components";

export const metadata: Metadata = {
  title: "ReelClue — Movie guessing, one clue at a time",
  description: "A mobile-first cinema quiz. 10 rounds of real movies, six distinct clue modes, and hints when you need them. No timer, no login.",
};

const steps = [
  {
    number: "1",
    title: "Pick your challenge",
    description: "Choose from six clue modes and three familiarity tiers: Easy, Medium, or Hard.",
    icon: Film,
  },
  {
    number: "2",
    title: "Inspect clues & hints",
    description: "Start each round with an initial clue. Reveal up to three progressive hints if you get stuck.",
    icon: Lightbulb,
  },
  {
    number: "3",
    title: "Guess the title",
    description: "Type freely or pick from catalog autocomplete. You have exactly three wrong attempts per round.",
    icon: HelpCircle,
  },
  {
    number: "4",
    title: "Score & finish",
    description: "Earn points based on difficulty, minus penalties for hints and wrong attempts. Complete 10 rounds.",
    icon: Trophy,
  },
];

export default function Home() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Top Navigation */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-280 items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 font-bold text-lg text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Film aria-hidden="true" className="size-6" />
            <span>ReelClue</span>
          </Link>
          <Link
            href="/play"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <Play aria-hidden="true" className="size-4 fill-current" />
            <span>Play Now</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-280 space-y-16 px-4 py-12 pb-[max(3rem,env(safe-area-inset-bottom))]">
        {/* Hero Section */}
        <section aria-labelledby="hero-heading" className="max-w-2xl space-y-5">
          <p className="font-semibold text-primary tracking-wide">
            Movie guessing, one clue at a time
          </p>
          <h1 id="hero-heading" className="text-4xl font-bold tracking-tight sm:text-5xl">
            ReelClue
          </h1>
          <p className="text-xl font-medium text-foreground">
            Every clue brings you closer.
          </p>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Ten rounds of real cinema trivia. Choose your clue mode, inspect progressive hints, and deduce the film before your attempts run out.
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Play aria-hidden="true" className="size-5 fill-current" />
              <span>Start Game</span>
            </Link>
            <a
              href="#how-to-play"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-input bg-secondary px-5 py-3 text-base font-semibold text-secondary-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              How to Play
            </a>
          </div>
        </section>

        {/* Game Modes Showcase */}
        <section aria-labelledby="modes-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="modes-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              A clue for every movie mind
            </h2>
            <p className="text-muted-foreground">
              Select any mode below to begin setup with that mode preselected.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {modes.map(mode => {
              const Icon = mode.icon;
              return (
                <Link
                  key={mode.id}
                  href={`/play?mode=${mode.id}`}
                  className="group relative flex min-h-28 flex-col justify-between rounded-lg border border-input bg-card p-5 transition-colors hover:border-primary hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
                >
                  <div className="flex items-start gap-3">
                    <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary">
                        {mode.label}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {mode.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-1 self-end text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <span>Play this mode</span>
                    <Play aria-hidden="true" className="size-3 fill-current" />
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* How to Play Section */}
        <section id="how-to-play" aria-labelledby="how-heading" className="space-y-6">
          <div className="space-y-2">
            <h2 id="how-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              How to play
            </h2>
            <p className="text-muted-foreground">
              Simple rules, pure deduction. No login wall, no timer, no penalties for quick thinking.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className="flex flex-col rounded-lg border border-input bg-card p-5 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary font-bold text-sm text-primary-foreground">
                      {step.number}
                    </span>
                    <Icon aria-hidden="true" className="size-5 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-foreground">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section
          aria-label="Ready to play"
          className="rounded-xl border border-input bg-card p-6 text-center sm:p-10 space-y-4"
        >
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to test your movie memory?
          </h2>
          <p className="mx-auto max-w-xl text-muted-foreground">
            Jump straight into a 10-round game. No sign-up required.
          </p>
          <div className="pt-2">
            <Link
              href="/play"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-primary px-8 py-3 text-base font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <Play aria-hidden="true" className="size-5 fill-current" />
              <span>Start Playing</span>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer with TMDB attribution */}
      <footer className="border-t border-border/50 py-8 text-center text-xs text-muted-foreground">
        <div className="mx-auto max-w-280 space-y-2 px-4">
          <p>ReelClue — A mobile-first movie guessing playground.</p>
          <p>
            This product uses the TMDB API but is not endorsed or certified by TMDB.
          </p>
        </div>
      </footer>
    </div>
  );
}
