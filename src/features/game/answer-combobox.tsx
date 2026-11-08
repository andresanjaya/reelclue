"use client";

import { useEffect, useId, useState } from "react";
import { Input } from "@/components/ui/input";

export type MovieChoice = {
  handle: string;
  title: string;
  year: number;
  choiceHandle?: string;
  releaseYear?: number;
};

import { useMovieSearch } from "./use-movie-search";

export { useMovieSearch };

export function SearchableAnswerCombobox({
  value,
  onValueChange,
  onSelect,
  disabled = false,
  minChars = 2,
  debounceMs = 300,
}: {
  value: string;
  onValueChange: (text: string) => void;
  onSelect: (choice: MovieChoice) => void;
  disabled?: boolean;
  minChars?: number;
  debounceMs?: number;
}) {
  const { choices, loading, error } = useMovieSearch(value, {
    minChars,
    debounceMs,
    enabled: !disabled,
  });

  return (
    <AnswerCombobox
      value={value}
      onValueChange={onValueChange}
      onSelect={onSelect}
      options={choices}
      loading={loading}
      error={error ?? undefined}
      disabled={disabled}
    />
  );
}

// Presentation-only accessible combobox foundation wired to safe server choices in RC-010.
export function AnswerCombobox({ value, onValueChange, onSelect, options, loading = false, error, disabled = false }: {
  value: string;
  onValueChange: (text: string) => void;
  onSelect: (choice: MovieChoice) => void;
  options: readonly MovieChoice[];
  loading?: boolean;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const visible = open && !disabled;
  const choices = loading || error ? [] : options.slice(0, 8);
  const index = active < choices.length ? active : -1;
  useEffect(() => {
    if (visible && index >= 0) document.getElementById(`${id}-option-${index}`)?.scrollIntoView?.({ block: "nearest" });
  }, [id, index, visible]);
  const select = (choice: MovieChoice) => { onSelect(choice); setOpen(false); setActive(-1); };

  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-semibold">Movie title</label>
    <Input id={id} role="combobox" value={value} disabled={disabled} autoComplete="off" maxLength={150}
      aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-list`}
      aria-activedescendant={visible && index >= 0 ? `${id}-option-${index}` : undefined}
      aria-describedby={`${id}-help ${id}-status`}
      onFocus={() => setOpen(true)} onBlur={() => { setOpen(false); setActive(-1); }}
      onChange={event => { onValueChange(event.target.value); setActive(-1); setOpen(true); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) { if (event.key === "Enter") event.preventDefault(); return; }
        if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive(choices.length ? event.key === "ArrowDown" ? (index + 1) % choices.length : (index <= 0 ? choices.length : index) - 1 : -1);
        }
        if (event.key === "Enter" && visible) { event.preventDefault(); if (index >= 0) select(choices[index]); }
      }}
      placeholder="Type a title or choose a suggestion"
    />
    <p id={`${id}-help`} className="text-sm text-muted-foreground">Suggestions show title and year. Choosing one does not submit.</p>
    <p id={`${id}-status`} role="status" className="text-sm text-muted-foreground">
      {error || (loading ? "Searching titles…" : visible ? choices.length ? `${choices.length} suggestions. Use arrow keys to choose.` : "No suggestions. You can still type an answer." : "")}
    </p>
    <ul id={`${id}-list`} role="listbox" aria-label="Movie suggestions" hidden={!visible || choices.length === 0} aria-busy={loading}
      className="max-h-60 overflow-y-auto rounded-md border border-input bg-popover text-popover-foreground">
      {choices.map((choice, i) => <li key={choice.handle} id={`${id}-option-${i}`} role="option" aria-selected={index === i}
        onPointerDown={event => event.preventDefault()} onClick={() => select(choice)}
        className={`flex min-h-11 cursor-pointer items-center justify-between gap-3 break-words px-3 py-3 ${index === i ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}>
        <span className="min-w-0">{choice.title}</span><span className="shrink-0">{choice.year}</span>
      </li>)}
    </ul>
  </div>;
}
