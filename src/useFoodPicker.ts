import { type KeyboardEvent, useMemo, useState } from "react";
import type { Food } from "./calc";
import { searchFoods } from "./foods";

/** Search state shared by the food list and the per-meal add field:
 * arrows move the highlight, Enter picks it, Escape clears the query.
 * Picking a food clears the query, ready for the next one. */
export function useFoodPicker(onPick: (food: Food) => void) {
  const [query, setQueryState] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const results = useMemo(() => searchFoods(query), [query]);

  function setQuery(value: string) {
    setQueryState(value);
    setHighlighted(0);
  }

  function pick(food: Food) {
    onPick(food);
    setQuery("");
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlighted(
        (index) => (index + step + results.length) % results.length,
      );
    } else if (event.key === "Enter") {
      const food = results[highlighted];
      if (!food) return;
      event.preventDefault();
      pick(food);
    } else if (event.key === "Escape") {
      setQuery("");
    }
  }

  return {
    query,
    setQuery,
    results,
    highlighted,
    setHighlighted,
    pick,
    onKeyDown,
  };
}
