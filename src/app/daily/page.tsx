import type { Metadata } from "next";
import { DailyView } from "@/features/daily/daily-view";

export const metadata: Metadata = {
  title: "Daily Challenge — ReelClue",
  description:
    "Play today's official 10-round movie puzzle. One shared challenge every day for cinema lovers worldwide. No timer, no login.",
};

export default function DailyPage() {
  return <DailyView />;
}

