import type { Metadata } from "next";
import { AboutView } from "@/features/about/about-view";

export const metadata: Metadata = {
  title: "About & Credits — ReelClue",
  description:
    "Learn about ReelClue, TMDB movie metadata attribution, privacy, cookie lifecycle, and familiarity proxies.",
};

export default function AboutPage() {
  return <AboutView />;
}
