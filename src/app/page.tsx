export default function Home() {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl flex-col justify-center gap-6 px-4 py-12">
      <p className="text-base font-semibold text-primary">Movie guessing, one clue at a time</p>
      <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">ReelClue</h1>
      <p className="text-xl">Every clue brings you closer.</p>
      <p className="max-w-prose leading-relaxed text-muted-foreground">
        A mobile-first movie quiz is taking shape. Gameplay is not available yet.
      </p>
    </main>
  );
}
