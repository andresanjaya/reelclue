import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ReelClue — Movie Guessing Playground",
    short_name: "ReelClue",
    description: "A mobile-first movie guessing game with fair tiers and spoiler-free sharing.",
    start_url: "/",
    display: "standalone",
    background_color: "#10131a",
    theme_color: "#10131a",
    orientation: "portrait",
    scope: "/",
    categories: ["games", "entertainment"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
