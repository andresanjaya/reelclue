import type { Metadata } from "next";
import { GameplayShell } from "@/features/game/gameplay-shell";

export const metadata: Metadata = {
  title: "Play ReelClue",
  description: "Guess the movie from progressive clues in ReelClue.",
};

export default async function PlaySessionPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;

  return <GameplayShell sessionId={id} />;
}
