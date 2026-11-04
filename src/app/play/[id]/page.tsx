import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";
import { ClueSkeleton } from "@/features/game/components";

export const metadata: Metadata = {
  title: "Playing ReelClue",
};

export default async function PlaySessionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return (
    <main className="mx-auto max-w-280 space-y-6 px-4 py-8">
      <header className="flex items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 font-bold text-primary">
          <Film aria-hidden="true" className="size-5" />
          <span>ReelClue</span>
        </Link>
        <span className="text-xs text-muted-foreground font-mono">Session {id.slice(0, 8)}</span>
      </header>
      <div className="rounded-lg border border-input bg-card p-6 space-y-4">
        <ClueSkeleton />
      </div>
    </main>
  );
}
