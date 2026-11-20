import { type Food, type Meal, mealTotal, portionNutrients } from "../calc";
import { formatNumber, formatNutrient } from "../format";
import type { PlannedPortion } from "../plan";
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
  onGrams,
}: {
  slot: string;
  slotIndex: number;
  /** Rows as stored in the plan; `meal` is the same rows resolved for `src/calc`. */
  portions: readonly PlannedPortion[];
  meal: Meal;
  active: boolean;
  onActivate: () => void;
  onAdd: (food: Food) => void;
  onRemove: (portionId: string) => void;
  onGrams: (portionId: string, grams: number) => void;
}) {
  const total = mealTotal(meal);
  const headingId = `meal-${slotIndex}`;

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
          {formatNumber(total.caloriesKcal)} kcal
        </span>
      </header>
      {portions.length > 0 && (
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
              const portion = meal[index];
              if (!portion) return null;
              const nutrients = portionNutrients(portion);
              const { food } = portion;
              return (
                <tr key={planned.id}>
                  <th scope="row">{food.name}</th>
                  <td className="num">
                    <GramsInput
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
                    {formatNutrient(nutrients.caloriesKcal, food.caloriesKcal)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="remove"
                      aria-label={`Rimuovi ${food.name}`}
                      title="Rimuovi"
                      onClick={() => onRemove(planned.id)}
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
              <td className="num">{formatNumber(total.proteinG)}</td>
              <td className="num">{formatNumber(total.fatG)}</td>
              <td className="num">{formatNumber(total.carbohydratesG)}</td>
              <td className="num">{formatNumber(total.caloriesKcal)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
      <FoodCombobox label={`Aggiungi alimento a ${slot}`} onAdd={onAdd} />
    </section>
  );
}
