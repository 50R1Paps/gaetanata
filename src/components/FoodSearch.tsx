import { useId } from "react";
import type { Food } from "../calc";
import { formatNutrient } from "../format";
import { useFoodPicker } from "../useFoodPicker";

export function FoodSearch({
  targetLabel,
  onAdd,
}: {
  targetLabel: string;
  onAdd: (food: Food) => void;
}) {
  const picker = useFoodPicker(onAdd);
  const listId = useId();
  const optionId = (index: number) => `${listId}-${index}`;

  return (
    <aside className="panel food-search" aria-label="Alimenti">
      <h2>Alimenti</h2>
      <input
        type="search"
        role="combobox"
        aria-label="Cerca alimento"
        aria-controls={listId}
        aria-expanded="true"
        aria-activedescendant={
          picker.results.length > 0 ? optionId(picker.highlighted) : undefined
        }
        placeholder="Cerca alimento…"
        value={picker.query}
        onChange={(event) => picker.setQuery(event.target.value)}
        onKeyDown={picker.onKeyDown}
      />
      <p className="hint">
        Invio o clic per aggiungere a <strong>{targetLabel}</strong>. Calorie
        per 100 g.
      </p>
      <div className="food-list" id={listId} role="listbox">
        {picker.results.map((food, index) => (
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
            <span>{food.name}</span>
            <span className="muted">
              {formatNutrient(food.caloriesKcal ?? 0, food.caloriesKcal)} kcal
            </span>
          </div>
        ))}
        {picker.results.length === 0 && (
          <div className="muted empty">Nessun alimento trovato</div>
        )}
      </div>
    </aside>
  );
}
