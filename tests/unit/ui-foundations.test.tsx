import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { AnswerCombobox, type MovieChoice } from "../../src/features/game/answer-combobox";
import { LevelSelector, ModeCard, modes } from "../../src/features/game/components";

const options: MovieChoice[] = [
  { handle: "one", title: "Fictional film", year: 1999 },
  { handle: "two", title: "Fictional film", year: 2020 },
];

function Demo({ submit, select, loading = false, error, disabled = false }: { submit: () => void; select: (choice: MovieChoice) => void; loading?: boolean; error?: string; disabled?: boolean }) {
  const [text, setText] = useState("");
  return <form onSubmit={event => { event.preventDefault(); submit(); }}>
    <AnswerCombobox value={text} onValueChange={setText} onSelect={choice => { select(choice); setText(choice.title); }} options={options} loading={loading} error={error} disabled={disabled} />
    <button type="submit">Submit</button>
  </form>;
}

describe("UI foundations", () => {
  it("labels six native mode radios and reports selection without game actions", () => {
    const change = vi.fn();
    render(<fieldset><legend>Mode</legend>{modes.map(mode => <ModeCard key={mode.id} mode={mode} name="mode" checked={mode.id === "poster"} onChange={change} />)}</fieldset>);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    expect(screen.getByRole("radio", { name: /Poster Blur/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Mixed/ }));
    expect(change).toHaveBeenCalledOnce();
  });

  it("labels levels and keeps disabled choices inactive", () => {
    const change = vi.fn();
    const { rerender } = render(<LevelSelector name="level" value="Easy" onChange={change} />);
    fireEvent.click(screen.getByRole("radio", { name: /Hard/ }));
    expect(change).toHaveBeenCalledWith("Hard");
    rerender(<LevelSelector name="level" value="Easy" onChange={change} disabled />);
    expect(screen.getByRole("radio", { name: /Hard/ })).toBeDisabled();
  });

  it("exposes listbox relationships, years and keyboard selection without submitting", () => {
    const select = vi.fn(); const submit = vi.fn();
    render(<Demo select={select} submit={submit} />);
    const input = screen.getByRole("combobox", { name: "Movie title" });
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("listbox")).toHaveAttribute("id", input.getAttribute("aria-controls"));
    expect(screen.getByRole("option", { name: /1999/ })).toBeVisible();
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(screen.getByRole("option", { name: /2020/ })).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(select).toHaveBeenCalledWith(options[1]);
    expect(submit).not.toHaveBeenCalled();
    expect(input).toHaveValue("Fictional film");
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.change(input, { target: { value: "Edited title" } });
    expect(input).toHaveValue("Edited title");
    expect(input).not.toHaveAttribute("aria-activedescendant");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.submit(input.closest("form")!);
    expect(submit).toHaveBeenCalledOnce();
  });

  it("handles pointer selection and clears active suggestion on blur", () => {
    const select = vi.fn();
    render(<Demo select={select} submit={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.click(screen.getByRole("option", { name: /1999/ }));
    expect(select).toHaveBeenCalledWith(options[0]);
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.blur(input);
    expect(input).toHaveAttribute("aria-expanded", "false");
    expect(input).not.toHaveAttribute("aria-activedescendant");
  });

  it("prevents open-list Enter with no active item and IME Enter from becoming submit", () => {
    const select = vi.fn();
    render(<Demo select={select} submit={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(fireEvent.keyDown(input, { key: "Enter", isComposing: true })).toBe(false);
    expect(select).not.toHaveBeenCalled();
  });

  it("announces loading/error without selectable stale suggestions or losing text", () => {
    const props = { select: vi.fn(), submit: vi.fn() };
    const { rerender } = render(<Demo {...props} />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "Keep me" } });
    rerender(<Demo {...props} loading />);
    expect(screen.getByRole("status")).toHaveTextContent("Searching titles");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(fireEvent.keyDown(input, { key: "Enter" })).toBe(false);
    rerender(<Demo {...props} error="Retry search" />);
    expect(screen.getByRole("status")).toHaveTextContent("Retry search");
    expect(input).toHaveValue("Keep me");
    rerender(<Demo {...props} disabled />);
    expect(input).toBeDisabled();
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("caps suggestions at eight and announces empty results", () => {
    const props = { value: "", onValueChange: vi.fn(), onSelect: vi.fn() };
    const { rerender } = render(<AnswerCombobox {...props} options={Array.from({ length: 12 }, (_, i) => ({ handle: `${i}`, title: `Demo ${i}`, year: 2000 }))} />);
    fireEvent.focus(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option")).toHaveLength(8);
    rerender(<AnswerCombobox {...props} options={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("No suggestions");
  });

  it("measures semantic text and control contrast from actual CSS tokens", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const color = (token: string) => css.match(new RegExp(`--${token}: (#[0-9a-f]{6});`, "i"))![1];
    const luminance = (hex: string) => {
      const rgb = hex.slice(1).match(/../g)!.map(value => parseInt(value, 16) / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const contrast = (a: string, b: string) => { const values = [luminance(color(a)), luminance(color(b))].sort((x, y) => y - x); return (values[0] + 0.05) / (values[1] + 0.05); };
    for (const bg of ["background", "card", "accent"]) {
      for (const fg of ["foreground", "muted-foreground", "primary", "success", "destructive"]) expect(contrast(fg, bg), `${fg}/${bg}`).toBeGreaterThanOrEqual(4.5);
      for (const fg of ["input", "ring"]) expect(contrast(fg, bg), `${fg}/${bg}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast("primary-foreground", "primary")).toBeGreaterThanOrEqual(4.5);
  });
});
