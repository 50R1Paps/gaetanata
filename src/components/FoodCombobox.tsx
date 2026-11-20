import { useId, useState } from "react";
import type { Food } from "../calc";
import { useFoodPicker } from "../useFoodPicker";

const maxSuggestions = 8;

/** Type-ahead field in a meal card: adds a food, or replaces an unknown one. */
export function FoodCombobox({
  label,
  placeholder,
  onAdd,
}: {
  label: string;
  placeholder: string;
  onAdd: (food: Food) => void;
}) {
  const picker = useFoodPicker(onAdd);
  const [focused, setFocused] = useState(false);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;
  const suggestions = picker.results.slice(0, maxSuggestions);
  const open = focused && picker.query.trim() !== "";

  return (
    <div className="combobox">
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open}
        aria-activedescendant={
          open && suggestions.length > 0
            ? optionId(Math.min(picker.highlighted, suggestions.length - 1))
            : undefined
        }
        placeholder={placeholder}
        value={picker.query}
        onChange={(event) => picker.setQuery(event.target.value)}
        onKeyDown={(event) => {
          // Keep the highlight within the visible suggestions.
          if (
            event.key === "ArrowDown" &&
            picker.highlighted >= suggestions.length - 1
          ) {
            event.preventDefault();
            picker.setHighlighted(0);
            return;
          }
          if (event.key === "ArrowUp" && picker.highlighted === 0) {
            event.preventDefault();
            picker.setHighlighted(Math.max(suggestions.length - 1, 0));
            return;
          }
          picker.onKeyDown(event);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
      <div id={listId} role="listbox" className="suggestions" hidden={!open}>
        {suggestions.map((food, index) => (
          <div
            key={food.name}
            id={optionId(index)}
            role="option"
            tabIndex={-1}
            aria-selected={index === picker.highlighted}
            onMouseDown={(event) => event.preventDefault()}
            onMouseEnter={() => picker.setHighlighted(index)}
            onClick={() => picker.pick(food)}
            onKeyDown={(event) => {
              if (event.key === "Enter") picker.pick(food);
            }}
          >
            {food.name}
          </div>
        ))}
        {suggestions.length === 0 && (
          <div className="muted empty">Nessun alimento trovato</div>
        )}
      </div>
    </div>
  );
}
