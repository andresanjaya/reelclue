import { Suspense } from "react";
import type { Metadata } from "next";
import { PlaySetup } from "@/features/game/play-setup";
import { ClueSkeleton } from "@/features/game/components";

export const metadata: Metadata = {
  title: "Game Setup — ReelClue",
  description: "Configure clue mode and difficulty level to begin your 10-round movie guessing game.",
};

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-280 space-y-8 px-4 py-8">
          <ClueSkeleton />
        </main>
      }
    >
      <PlaySetup />
    </Suspense>
  );
}
