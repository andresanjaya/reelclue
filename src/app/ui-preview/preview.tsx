"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnswerCombobox, type MovieChoice } from "@/features/game/answer-combobox";
import { ClueSkeleton, Feedback, GameHeader, LevelSelector, ModeCard, modes, type Level, type Mode } from "@/features/game/components";

const choices: MovieChoice[] = [
  { handle: "demo-1", title: "The Lantern at the Edge of the World", year: 1998 },
  { handle: "demo-2", title: "The Lantern at the Edge of the World", year: 2020 },
  { handle: "demo-3", title: "A Very Long Fictional Movie Title That Wraps Across Small Screens", year: 2006 },
];

export function UiPreview() {
  const [mode, setMode] = useState<Mode>("poster");
  const [level, setLevel] = useState<Level>("Easy");
  const [text, setText] = useState("");
  const [choice, setChoice] = useState<MovieChoice | null>(null);
  const [feedback, setFeedback] = useState("Demo only. No answer is sent to a server.");
  const [searchState, setSearchState] = useState("ready");

  return <main className="mx-auto max-w-280 space-y-8 px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
    <header className="max-w-2xl space-y-3">
      <p className="flex items-center gap-2 font-semibold text-primary"><Film aria-hidden="true" className="size-5" /> ReelClue · UI foundations</p>
      <h1 className="text-3xl font-bold tracking-tight">Every clue brings you closer.</h1>
      <p className="text-muted-foreground">Component preview, not a playable game. Selections stay on this page. Movie suggestions and scores below are fictional demo data.</p>
    </header>

    <section aria-labelledby="modes-heading" className="space-y-4">
      <h2 id="modes-heading" className="text-2xl font-semibold">A clue for every kind of movie mind</h2>
      <fieldset className="min-w-0"><legend className="mb-3 text-muted-foreground">Choose a demo mode</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{modes.map(item => <ModeCard key={item.id} mode={item} name="demo-mode" value={item.id} checked={mode === item.id} onChange={() => setMode(item.id)} />)}</div>
      </fieldset>
      <LevelSelector name="demo-level" value={level} onChange={setLevel} />
      <p className="text-sm text-muted-foreground">Preview selection: {modes.find(item => item.id === mode)?.label} / {level}. No session created.</p>
    </section>

    <div className="grid min-w-0 gap-6 md:grid-cols-2">
      <section aria-labelledby="answer-heading" className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 id="answer-heading" className="text-2xl font-semibold">Answer controls</h2>
        <p className="text-sm text-muted-foreground">Sample round, not live progress.</p>
        <GameHeader round={3} total={10} mode={modes.find(item => item.id === mode)!.label} level={level} attempts={2} score={150} />
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); setFeedback(`Demo submission received: ${choice ? `${choice.title} (${choice.year})` : text}. No score calculated.`); }}>
          <AnswerCombobox value={text} onValueChange={value => { setText(value); setChoice(null); }} onSelect={value => { setChoice(value); setText(value.title); }} options={choices.filter(item => item.title.toLowerCase().includes(text.toLowerCase()))} loading={searchState === "loading"} error={searchState === "error" ? "Demo search failed. Your typed answer is unchanged." : undefined} />
          <Button type="submit" disabled={!text.trim()}>Submit demo answer</Button>
        </form>
        <Feedback>{feedback}</Feedback>
        <label className="block space-y-2"><span className="block font-semibold">Preview search state</span><select value={searchState} onChange={event => setSearchState(event.target.value)} className="min-h-12 w-full rounded-md border border-input bg-background px-3 text-base"><option value="ready">Ready (fictional suggestions)</option><option value="loading">Loading</option><option value="error">Recoverable error</option></select></label>
        <Button disabled variant="secondary">Gameplay not available</Button>
      </section>

      <section aria-labelledby="states-heading" className="min-w-0 space-y-4 rounded-lg border bg-card p-4 sm:p-5">
        <h2 id="states-heading" className="text-2xl font-semibold">Feedback & loading</h2>
        <Feedback tone="success">Success example: your selection is ready.</Feedback>
        <Feedback tone="error">Error example: clue unavailable. Attempts have not changed.</Feedback>
        <ClueSkeleton />
      </section>
    </div>
  </main>;
}
