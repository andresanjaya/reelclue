import type { Metadata } from "next";
import { env } from "@/lib/server/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(env.APP_BASE_URL),
  title: "ReelClue — Every clue brings you closer",
  description: "A mobile-first movie guessing game. Currently in development.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
