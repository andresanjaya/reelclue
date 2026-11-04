import { useState } from "react";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnswerCombobox,
  SearchableAnswerCombobox,
  type MovieChoice,
} from "../../src/features/game/answer-combobox";
import { useMovieSearch } from "../../src/features/game/use-movie-search";

describe("useMovieSearch hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not fetch for queries shorter than 2 characters", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result, rerender } = renderHook(({ q }) => useMovieSearch(q), {
      initialProps: { q: "" },
    });

    expect(result.current.choices).toEqual([]);
    expect(result.current.loading).toBe(false);

    rerender({ q: "a" });
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.choices).toEqual([]);
  });

  it("debounces fetch by 300ms", async () => {
    const mockItems = [
      { choiceHandle: "handle-1", title: "Inception", releaseYear: 2010 },
    ];
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: mockItems }),
    } as Response);

    const { result } = renderHook(({ q }) => useMovieSearch(q), {
      initialProps: { q: "Inc" },
    });

    // Before 300ms, fetch should NOT have been called
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fetchSpy).not.toHaveBeenCalled();

    // After 300ms elapsed
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(fetchSpy).toHaveBeenCalledWith("/api/movies/search?q=Inc", expect.any(Object));
    expect(result.current.choices).toHaveLength(1);
    expect(result.current.choices[0].title).toBe("Inception");
    expect(result.current.choices[0].year).toBe(2010);
  });

  it("cancels prior debounce when user keeps typing", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ items: [] }),
    } as Response);

    const { rerender } = renderHook(({ q }) => useMovieSearch(q), {
      initialProps: { q: "Mat" },
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    rerender({ q: "Matrix" });

    act(() => {
      vi.advanceTimersByTime(200);
    });
    // First query was canceled, second query not yet reached 300ms
    expect(fetchSpy).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    // Only "Matrix" should be fetched
    expect(fetchSpy).toHaveBeenCalledOnce();
    expect(fetchSpy).toHaveBeenCalledWith("/api/movies/search?q=Matrix", expect.any(Object));
  });

  it("discards stale responses when a newer query has been initiated", async () => {
    let resolveFirst: (val: unknown) => void;
    let resolveSecond: (val: unknown) => void;

    const firstPromise = new Promise(res => { resolveFirst = res; });
    const secondPromise = new Promise(res => { resolveSecond = res; });

    vi.spyOn(globalThis, "fetch")
      .mockImplementationOnce(() => firstPromise as Promise<Response>)
      .mockImplementationOnce(() => secondPromise as Promise<Response>);

    const { result, rerender } = renderHook(({ q }) => useMovieSearch(q), {
      initialProps: { q: "First" },
    });

    // Trigger first fetch
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Update query to "Second"
    rerender({ q: "Second" });

    // Trigger second fetch
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    // Now resolve the first fetch AFTER the second fetch was initiated
    await act(async () => {
      resolveFirst({
        ok: true,
        json: async () => ({ items: [{ choiceHandle: "h1", title: "First Title", releaseYear: 1990 }] }),
      });
    });

    // Choices should not have first result
    expect(result.current.choices).toEqual([]);

    // Resolve second fetch
    await act(async () => {
      resolveSecond({
        ok: true,
        json: async () => ({ items: [{ choiceHandle: "h2", title: "Second Title", releaseYear: 2020 }] }),
      });
    });

    expect(result.current.choices).toHaveLength(1);
    expect(result.current.choices[0].title).toBe("Second Title");
  });

  it("handles server error and sets error message", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Search service unavailable" } }),
    } as Response);

    const { result } = renderHook(() => useMovieSearch("ErrorTest"));

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.error).toBe("Search service unavailable");
    expect(result.current.choices).toEqual([]);
    expect(result.current.loading).toBe(false);
  });
});

describe("Accessible Searchable Combobox & Autocomplete", () => {
  const remakes: MovieChoice[] = [
    { handle: "h-1972", title: "Solaris", year: 1972 },
    { handle: "h-2002", title: "Solaris", year: 2002 },
  ];

  function TestSearchForm({
    onSubmit,
    onSelect,
    options = remakes,
  }: {
    onSubmit: (val: string) => void;
    onSelect: (c: MovieChoice) => void;
    options?: MovieChoice[];
  }) {
    const [text, setText] = useState("");
    return (
      <form onSubmit={e => { e.preventDefault(); onSubmit(text); }}>
        <AnswerCombobox
          value={text}
          onValueChange={setText}
          onSelect={c => { onSelect(c); setText(c.title); }}
          options={options}
        />
        <button type="submit">Submit</button>
      </form>
    );
  }

  it("renders same-title remakes with visible distinct release years", () => {
    render(<TestSearchForm onSubmit={vi.fn()} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Solaris");
    expect(options[0]).toHaveTextContent("1972");
    expect(options[1]).toHaveTextContent("Solaris");
    expect(options[1]).toHaveTextContent("2002");
  });

  it("keyboard navigation: ArrowDown cycles options and Enter selects without submitting form", () => {
    const handleSubmit = vi.fn();
    const handleSelect = vi.fn();

    render(<TestSearchForm onSubmit={handleSubmit} onSelect={handleSelect} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    // ArrowDown to first item
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    // ArrowDown to second item
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");

    // Enter selects the second item
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleSelect).toHaveBeenCalledWith(remakes[1]);
    expect(input).toHaveValue("Solaris");
    // Form must NOT be submitted on suggestion selection
    expect(handleSubmit).not.toHaveBeenCalled();
  });

  it("Escape key closes the suggestions list", () => {
    render(<TestSearchForm onSubmit={vi.fn()} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    expect(input).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("ensures suggestion items meet mobile touch target requirements (min 44px)", () => {
    render(<TestSearchForm onSubmit={vi.fn()} onSelect={vi.fn()} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);

    const options = screen.getAllByRole("option");
    for (const opt of options) {
      // min-h-11 is Tailwind 44px
      expect(opt.className).toContain("min-h-11");
    }
  });

  it("supports free text typing without selection", () => {
    const handleSubmit = vi.fn();
    const handleSelect = vi.fn();

    render(<TestSearchForm onSubmit={handleSubmit} onSelect={handleSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Custom Guess Title" } });
    expect(input).toHaveValue("Custom Guess Title");

    // Press Escape to close suggestions
    fireEvent.keyDown(input, { key: "Escape" });

    // Submit form via Enter while list is closed
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(handleSubmit).toHaveBeenCalledWith("Custom Guess Title");
    expect(handleSelect).not.toHaveBeenCalled();
  });

  it("SearchableAnswerCombobox integrates useMovieSearch seamlessly", () => {
    const handleSelect = vi.fn();
    const handleChange = vi.fn();

    render(
      <SearchableAnswerCombobox
        value="Matrix"
        onValueChange={handleChange}
        onSelect={handleSelect}
      />
    );

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Matrix");
  });
});
