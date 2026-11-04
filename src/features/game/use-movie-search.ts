"use client";

import { useEffect, useRef, useState } from "react";
import type { MovieChoice } from "./answer-combobox";

export interface UseMovieSearchOptions {
  minChars?: number;
  debounceMs?: number;
  enabled?: boolean;
}

export interface UseMovieSearchResult {
  choices: MovieChoice[];
  loading: boolean;
  error: string | null;
  clear: () => void;
}

export function useMovieSearch(
  query: string,
  options?: UseMovieSearchOptions
): UseMovieSearchResult {
  const minChars = options?.minChars ?? 2;
  const debounceMs = options?.debounceMs ?? 300;
  const enabled = options?.enabled ?? true;

  const [rawChoices, setRawChoices] = useState<MovieChoice[]>([]);
  const [rawLoading, setRawLoading] = useState(false);
  const [rawError, setRawError] = useState<string | null>(null);

  const activeControllerRef = useRef<AbortController | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestQueryRef = useRef<string>("");

  const trimmed = query.trim();
  const isQueryActive = enabled && trimmed.length >= minChars;

  const clear = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
      activeControllerRef.current = null;
    }
    setRawChoices([]);
    setRawLoading(false);
    setRawError(null);
  };

  useEffect(() => {
    latestQueryRef.current = trimmed;

    // Clear any previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (!isQueryActive) {
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
        activeControllerRef.current = null;
      }
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      // Abort any ongoing fetch
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }

      const controller = new AbortController();
      activeControllerRef.current = controller;
      setRawLoading(true);
      setRawError(null);

      try {
        const res = await fetch(`/api/movies/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
          headers: { "Accept": "application/json" },
        });

        // If another query was initiated, ignore this response
        if (latestQueryRef.current !== trimmed) {
          return;
        }

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          const message = body?.error?.message ?? "Failed to search movies";
          setRawError(message);
          setRawChoices([]);
        } else {
          const data = await res.json();
          const items: MovieChoice[] = (data.items ?? []).map((item: {
            choiceHandle?: string;
            handle?: string;
            title: string;
            releaseYear?: number;
            year?: number;
          }) => ({
            handle: item.choiceHandle ?? item.handle ?? "",
            title: item.title,
            year: item.releaseYear ?? item.year ?? 0,
            choiceHandle: item.choiceHandle ?? item.handle,
            releaseYear: item.releaseYear ?? item.year,
          }));

          setRawChoices(items);
          setRawError(null);
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        if (latestQueryRef.current === trimmed) {
          setRawError("Network error while searching");
          setRawChoices([]);
        }
      } finally {
        if (latestQueryRef.current === trimmed) {
          setRawLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (activeControllerRef.current) {
        activeControllerRef.current.abort();
      }
    };
  }, [trimmed, isQueryActive, debounceMs]);

  return {
    choices: isQueryActive ? rawChoices : [],
    loading: isQueryActive ? rawLoading : false,
    error: isQueryActive ? rawError : null,
    clear,
  };
}
