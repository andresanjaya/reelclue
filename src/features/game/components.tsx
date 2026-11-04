import type { ComponentProps } from "react";
import { Check, CircleAlert, CircleCheck, Film, HelpCircle, ScanEye, Shapes, Shuffle, TextCursorInput, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export const modes = [
  { id: "poster", label: "Poster Blur", description: "Find the film behind the blur.", icon: ScanEye },
  { id: "title", label: "Missing Title", description: "Fill the gaps in a familiar title.", icon: TextCursorInput },
  { id: "synopsis", label: "Synopsis", description: "Follow the story, name the movie.", icon: Film },
  { id: "cast", label: "Director & Cast", description: "Connect the people behind the film.", icon: Users },
  { id: "genre", label: "Genre Detective", description: "Piece together genres and eras.", icon: Shapes },
  { id: "mixed", label: "Mixed", description: "A little of every kind of clue.", icon: Shuffle },
] as const;

export type Mode = typeof modes[number]["id"];
export type Level = "Easy" | "Medium" | "Hard";

export function ModeCard({ mode, className, ...props }: Omit<ComponentProps<"input">, "type"> & { mode: typeof modes[number] }) {
  const Icon = mode.icon;
  return (
    <label className={cn("relative flex min-h-28 min-w-0 items-start gap-3 rounded-lg border border-input bg-card p-4 has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-50", className)}>
      <input {...props} type="radio" className="peer sr-only" />
      <Icon aria-hidden="true" className="mt-1 size-5 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 break-words">
        <span className="block font-semibold">{mode.label}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{mode.description}</span>
      </span>
      <Check aria-hidden="true" className="size-5 shrink-0 opacity-0 peer-checked:opacity-100" />
    </label>
  );
}

const levels = [
  { label: "Easy", description: "Familiar favourites" },
  { label: "Medium", description: "For regular movie watchers" },
  { label: "Hard", description: "Well-regarded hidden gems" },
] as const;

export function LevelSelector({ name, value, onChange, disabled = false }: { name: string; value: Level; onChange: (level: Level) => void; disabled?: boolean }) {
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend className="mb-3 font-semibold">Difficulty</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {levels.map(level => (
          <label key={level.label} className="flex min-h-11 min-w-0 items-start gap-3 rounded-md border border-input bg-card p-3 has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-2 has-focus-visible:outline-offset-4 has-focus-visible:outline-ring has-disabled:cursor-not-allowed has-disabled:opacity-50">
            <input type="radio" name={name} value={level.label} checked={value === level.label} onChange={() => onChange(level.label)} className="mt-1 size-4 shrink-0 accent-primary" />
            <span className="min-w-0 break-words"><span className="block font-semibold">{level.label}</span><span className="block text-sm text-muted-foreground">{level.description}</span></span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function GameHeader({ round, total, mode, level, attempts, score }: { round: number; total: number; mode: string; level: Level; attempts: number; score: number }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <p>Round <span className="font-semibold text-foreground">{round}/{total}</span></p>
        <p className="break-words">{mode} · {level}</p>
      </div>
      <progress aria-label="Round progress" value={round} max={total} className="block h-2 w-full overflow-hidden rounded-full" />
      <div className="flex flex-wrap justify-between gap-3"><p>{attempts} attempts left</p><p>Score <strong>{score}</strong></p></div>
    </header>
  );
}

export function Feedback({ tone = "info", children }: { tone?: "info" | "success" | "error"; children?: React.ReactNode }) {
  const Icon = tone === "success" ? CircleCheck : tone === "error" ? CircleAlert : HelpCircle;
  return <div role="status" aria-live="polite" aria-atomic="true" className={cn("flex min-h-12 items-start gap-2 rounded-md py-3", tone === "success" ? "text-success" : tone === "error" ? "text-destructive" : "text-muted-foreground")}>
    {children && <><Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><span className="min-w-0 break-words">{children}</span></>}
  </div>;
}

export function ClueSkeleton() {
  return <div role="status" aria-label="Loading clue" className="space-y-4">
    <div aria-hidden="true" className="space-y-4"><Skeleton className="mx-auto aspect-2/3 w-full max-w-55" /><Skeleton className="h-12 w-full" /><Skeleton className="h-11 w-32" /></div>
    <span className="sr-only">Loading clue…</span>
  </div>;
}
