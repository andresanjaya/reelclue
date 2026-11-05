"use client";

import { useState } from "react";
import { Film, Image as ImageIcon, Sparkles, User, Users } from "lucide-react";
import type { SafeClue } from "@/lib/server/game/clues";

export function ClueRenderer({ clue }: { clue: SafeClue }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  switch (clue.mode) {
    case "poster":
      return (
        <div className="flex flex-col items-center space-y-4 rounded-xl border border-input bg-card/60 p-4 sm:p-6">
          <div className="relative aspect-2/3 w-full max-w-65 overflow-hidden rounded-lg bg-secondary shadow-lg">
            {clue.posterUrl && failedUrl !== clue.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={retry ? `${clue.posterUrl}&retry=${retry}` : clue.posterUrl}
                alt="Movie poster clue"
                className="h-full w-full object-cover transition-opacity duration-300"
                loading="eager"
                onError={() => setFailedUrl(clue.posterUrl)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                <ImageIcon aria-hidden="true" className="size-12 opacity-50" />
              </div>
            )}
          </div>
          {failedUrl === clue.posterUrl && (
            <div role="alert" className="space-y-2 text-center text-sm text-muted-foreground">
              <p>Poster could not load. Attempts and score stay unchanged.</p>
              <button type="button" className="min-h-11 rounded-md border border-input px-4 font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" onClick={() => { setRetry(value => value + 1); setFailedUrl(null); }}>Retry poster</button>
            </div>
          )}
          {(clue.releaseYear || clue.primaryGenre) && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs">
              {clue.releaseYear && (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
                  Year: {clue.releaseYear}
                </span>
              )}
              {clue.primaryGenre && (
                <span className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 font-semibold text-primary">
                  Genre: {clue.primaryGenre}
                </span>
              )}
            </div>
          )}
        </div>
      );

    case "title":
      return (
        <div className="flex flex-col items-center justify-center space-y-3 rounded-xl border border-input bg-card/60 p-6 text-center sm:p-8">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <Sparkles aria-hidden="true" className="size-4" />
            <span>Missing Title Clue</span>
          </div>
          <p
            aria-label={`Masked title: ${clue.maskedTitle}`}
            className="w-full min-w-0 wrap-anywhere whitespace-pre-wrap font-mono text-2xl font-bold tracking-widest text-foreground select-none sm:text-4xl"
          >
            {clue.maskedTitle}
          </p>
          <p className="text-xs text-muted-foreground">
            Deduce the complete title from the exposed letters.
          </p>
        </div>
      );

    case "synopsis":
      return (
        <div className="space-y-4 rounded-xl border border-input bg-card/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <Film aria-hidden="true" className="size-4" />
            <span>Plot Synopsis</span>
          </div>
          <blockquote className="border-l-2 border-primary/50 pl-4 text-base leading-relaxed text-foreground italic sm:text-lg">
            &ldquo;{clue.synopsis}&rdquo;
          </blockquote>
          {(clue.decade || clue.primaryGenre || clue.director) && (
            <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3 text-xs">
              {clue.decade && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Era: {clue.decade}
                </span>
              )}
              {clue.primaryGenre && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Genre: {clue.primaryGenre}
                </span>
              )}
              {clue.director && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Director: {clue.director}
                </span>
              )}
            </div>
          )}
        </div>
      );

    case "cast":
      return (
        <div className="space-y-4 rounded-xl border border-input bg-card/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <Users aria-hidden="true" className="size-4" />
            <span>Director &amp; Cast</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Director</p>
            <p className="text-xl font-bold text-foreground">{clue.director}</p>
          </div>
          {clue.cast && clue.cast.length > 0 && (
            <div className="space-y-2 border-t border-border/50 pt-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Cast Members</p>
              <ul className="space-y-1">
                {clue.cast.map(actor => (
                  <li key={actor} className="flex items-center gap-2 font-medium text-foreground">
                    <User aria-hidden="true" className="size-4 text-primary" />
                    <span>{actor}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {clue.releaseYear && (
            <div className="border-t border-border/50 pt-2">
              <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                Release Year: {clue.releaseYear}
              </span>
            </div>
          )}
        </div>
      );

    case "genre":
      return (
        <div className="space-y-4 rounded-xl border border-input bg-card/60 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-primary uppercase">
            <Film aria-hidden="true" className="size-4" />
            <span>Genre Detective</span>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Genres</p>
            <div className="flex flex-wrap gap-2">
              {clue.genres.map(g => (
                <span
                  key={g}
                  className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>
          <div className="space-y-1 border-t border-border/50 pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Decade</p>
            <p className="text-lg font-medium text-foreground">{clue.decade}</p>
          </div>
          {(clue.originalLanguage || clue.director || clue.leadActor || clue.releaseYear) && (
            <div className="flex flex-wrap gap-2 border-t border-border/50 pt-3 text-xs">
              {clue.originalLanguage && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Language: {clue.originalLanguage.toUpperCase()}
                </span>
              )}
              {clue.director && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Director: {clue.director}
                </span>
              )}
              {clue.leadActor && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Lead: {clue.leadActor}
                </span>
              )}
              {clue.releaseYear && (
                <span className="rounded-md bg-secondary px-2.5 py-1 font-medium text-secondary-foreground">
                  Year: {clue.releaseYear}
                </span>
              )}
            </div>
          )}
        </div>
      );
  }
}
