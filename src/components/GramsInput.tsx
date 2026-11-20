import { useState } from "react";
import { formatGrams, parseGrams } from "../format";

/** Keeps the typed text while editing, so "32," or an empty field don't get
 * overwritten; only valid amounts reach the plan. */
export function GramsInput({
  grams,
  label,
  onChange,
}: {
  grams: number;
  label: string;
  onChange: (grams: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseGrams(draft) === null;

  return (
    <input
      className="grams"
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid}
      value={draft ?? formatGrams(grams)}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parseGrams(text);
        if (parsed !== null) onChange(parsed);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
