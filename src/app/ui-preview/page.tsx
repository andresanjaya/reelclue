import type { Metadata } from "next";
import { UiPreview } from "./preview";

export const metadata: Metadata = { title: "UI foundations preview — ReelClue", robots: { index: false, follow: false } };

export default function PreviewPage() {
  return <UiPreview />;
}
