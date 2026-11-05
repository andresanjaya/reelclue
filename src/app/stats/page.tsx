import type { Metadata } from "next";
import { StatsView } from "@/features/stats/stats-view";

export const metadata: Metadata = {
  title: "Device Statistics — ReelClue",
  description: "View your local movie quiz performance, accuracy, and records on this device.",
};

export default function StatsPage() {
  return <StatsView />;
}
