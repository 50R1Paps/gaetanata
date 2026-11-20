import { useEffect, useRef } from "react";
import { type Food, portionNutrients } from "../calc";
import { formatNumber, formatNutrient } from "../format";
import type { PlannedPortion, ResolvedMeal } from "../plan";
import { FoodCombobox } from "./FoodCombobox";
import { GramsInput } from "./GramsInput";

export function MealCard({
  slot,
  slotIndex,
  portions,
  meal,
  active,
  onActivate,
  onAdd,
  onRemove,
  onReplace,
  onGrams,
}: {
  slot: string;
  slotIndex: number;
  /** Rows as stored in the plan; `meal` is the same rows resolved for `src/calc`. */
  portions: readonly PlannedPortion[];
  meal: ResolvedMeal;
  active: boolean;
  onActivate: () => void;
  onAdd: (food: Food) => void;
  onRemove: (portionId: string) => void;
  onReplace: (portionId: string, food: Food) => void;
  onGrams: (portionId: string, grams: number) => void;
}) {
  const { total } = meal;
  const headingId = `meal-${slotIndex}`;
  const addId = `${headingId}-add`;
  const gramsId = (portionId: string) => `${headingId}-grams-${portionId}`;
  // Removing or replacing a row takes away the control that had focus: the
  // next render moves it to the add field or to the replaced row's grams.
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });

  function remove(portionId: string) {
    focusNext.current = addId;
    onRemove(portionId);
  }

  return (
    <section
      className={`meal-card meal-${slotIndex}${active ? " active" : ""}`}
      aria-labelledby={headingId}
      onFocus={onActivate}
    >
      <header>
        <h3 id={headingId}>
          <button type="button" onClick={onActivate} aria-pressed={active}>
            {slot}
          </button>
        </h3>
        <span className="meal-kcal">
          {total
            ? `${formatNumber(total.caloriesKcal)} kcal`
            : "Totale incompleto"}
        </span>
      </header>
      {portions.length > 0 && (
        <div className="table-scroll">
          <table>
            <colgroup>
              <col />
              <col className="col-grams" />
              <col className="col-value" />
              <col className="col-value" />
              <col className="col-value" />
              <col className="col-value" />
              <col className="col-remove" />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Alimento</th>
                <th scope="col" className="num">
                  g
                </th>
                <th scope="col" className="num">
                  Proteine
                </th>
                <th scope="col" className="num">
                  Grassi
                </th>
                <th scope="col" className="num">
                  Carboidrati
                </th>
                <th scope="col" className="num">
                  Kcal
                </th>
                <th scope="col">
                  <span className="visually-hidden">Rimuovi</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {portions.map((planned, index) => {
                const portion = meal.portions[index];
                if (!portion) {
                  return (
                    <tr key={planned.id} className="unknown">
                      <th scope="row">
                        {planned.food}
                        <p className="unknown-note">
                          <strong>Alimento non riconosciuto</strong>
                        </p>
                      </th>
                      <td className="num">
                        <GramsInput
                          id={gramsId(planned.id)}
                          grams={planned.grams}
                          label={`Grammi di ${planned.food}`}
                          onChange={(grams) => onGrams(planned.id, grams)}
                        />
                      </td>
                      <td colSpan={4}>Nutrienti non disponibili</td>
                      <td>
                        <button
                          type="button"
                          className="remove"
                          aria-label={`Rimuovi ${planned.food}`}
                          title="Rimuovi"
                          onClick={() => remove(planned.id)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                }
                const nutrients = portionNutrients(portion);
                const { food } = portion;
                return (
                  <tr key={planned.id}>
                    <th scope="row">{food.name}</th>
                    <td className="num">
                      <GramsInput
                        id={gramsId(planned.id)}
                        grams={planned.grams}
                        label={`Grammi di ${food.name}`}
                        onChange={(grams) => onGrams(planned.id, grams)}
                      />
                    </td>
                    <td className="num">
                      {formatNutrient(nutrients.proteinG, food.proteinG)}
                    </td>
                    <td className="num">
                      {formatNutrient(nutrients.fatG, food.fatG)}
                    </td>
                    <td className="num">
                      {formatNutrient(
                        nutrients.carbohydratesG,
                        food.carbohydratesG,
                      )}
                    </td>
                    <td className="num">
                      {formatNutrient(
                        nutrients.caloriesKcal,
                        food.caloriesKcal,
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="remove"
                        aria-label={`Rimuovi ${food.name}`}
                        title="Rimuovi"
                        onClick={() => remove(planned.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Totale</th>
                <td />
                {total ? (
                  <>
                    <td className="num">{formatNumber(total.proteinG)}</td>
                    <td className="num">{formatNumber(total.fatG)}</td>
                    <td className="num">
                      {formatNumber(total.carbohydratesG)}
                    </td>
                    <td className="num">{formatNumber(total.caloriesKcal)}</td>
                  </>
                ) : (
                  <td colSpan={4}>Totale incompleto</td>
                )}
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {/* Below the table, not in the row: the table's scroll box would clip
       * the suggestions. */}
      {portions.map(
        (planned, index) =>
          !meal.portions[index] && (
            <div key={planned.id} className="replace-unknown">
              <FoodCombobox
                label={`Sostituisci ${planned.food}`}
                placeholder={`Sostituisci ${planned.food} con…`}
                onAdd={(food) => {
                  focusNext.current = gramsId(planned.id);
                  onReplace(planned.id, food);
                }}
              />
            </div>
          ),
      )}
      <FoodCombobox
        id={addId}
        label={`Aggiungi alimento a ${slot}`}
        placeholder="+ Aggiungi alimento…"
        onAdd={onAdd}
      />
    </section>
  );
}
