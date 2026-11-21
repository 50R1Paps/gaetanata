/** Converts an already successful calculateSchema result to the free editor.
 * Patient/input validation and overrides belong to calculateSchema: pass its
 * result for the current patient/schema, not a separately recalculated copy.
 * Only the seven weekdays are converted; the extra pizza day is NOT converted.
 * Nuts go in Spuntini and yogurt in Merenda, once each every day, independently
 * of mealCount (these manual quantities are not meal macro allocations).
 * Oil is 30 ml/day split equally: 15 ml at lunch and 15 ml at dinner.
 * WeekPlan stores grams only: approximate densities below convert milk/oil ml
 * to grams. No density or rounding is applied to quantities already in grams.
 * IDs are deterministic and unique within a plan; no input is mutated.
 */

import foodSchema from "./data/food-schema.json" with { type: "json" };
import foods from "./data/foods.json" with { type: "json" };
import { isDayEmpty, type PlannedPortion, type WeekPlan } from "./plan.ts";
import {
  type SchemaDay,
  type SchemaProteinSource,
  schemaDays,
} from "./schema.ts";
import type { SchemaCalculation, SchemaProteinPortion } from "./schemaCalc.ts";

// Explicit approximation for the gram-only editor (not schema prescription units).
export const MILK_GRAMS_PER_ML = 1.03;
export const OIL_GRAMS_PER_ML = 0.92;
export const OIL_ML_PER_MEAL = 15;

/** Generic, unbranded foods where possible; null means the dataset has no
 * certain match. Yogurt uses the only plain low-fat entry, as the printed Word
 * prescribes «yogurt magro bianco».
 * Keep all choices here: never silently substitute another category or use an
 * uncertain classification (notably ambiguous "Ceci" for canned legumes).
 */
export const schemaRepresentativeFoods = {
  latte: { food: "Latte parzialmente scremato UHT", categoryId: "latte" },
  yogurt: { food: "yogurt magro (Vipiteno)", categoryId: "yogurt" },
  nuts: { food: "Mandorle", categoryId: "frutta-secca" },
  pasta: { food: "Pasta di semola", categoryId: "carboidrati" },
  bread: { food: "Pane bianco", categoryId: "carboidrati" },
  vegetables: { food: "Zucchine", categoryId: "verdura" },
  fruit: { food: "Mela con buccia", categoryId: "frutta" },
  oil: { food: "Olio EVO", categoryId: "grassi" },
  uova: { food: "Uova", categoryId: "uova" },
  pesce: { food: "Merluzzo", categoryId: "pesce" },
  carne_bianca: { food: "Pollo petto (crudo)", categoryId: "carne-bianca" },
  carne_rossa: { food: "Carne manzo", categoryId: "carne-rossa" },
  legumi_secchi: { food: "Lenticchie, secche", categoryId: "legumi-secchi" },
  legumi_scatola: { food: null, categoryId: "legumi-in-scatola" },
  formaggio_fresco: { food: "Ricotta", categoryId: "formaggio-fresco" },
  formaggio_stagionato: { food: "Grana", categoryId: "formaggio-stagionato" },
  affettati: { food: "Prosciutto cotto", categoryId: "affettati" },
  pesce_scatola: { food: "Tonno (in scatola)", categoryId: "pesce-in-scatola" },
} as const;

type RepresentativeKey = keyof typeof schemaRepresentativeFoods;
export type SkippedPortion = {
  day: SchemaDay;
  meal: "lunch" | "dinner";
  source: SchemaProteinSource;
  reason: string;
};

// Check the live datasets as well as the explicit table, so future category
// reviews cannot introduce unknown or uncertain foods into converted plans.
const knownNames = new Set(foods.map((food) => food.name));
const categories: Record<
  string,
  { categoryId: string | null; uncertain: boolean }
> = foodSchema.foods;
function representative(key: RepresentativeKey): string | null {
  const { food, categoryId } = schemaRepresentativeFoods[key];
  if (food === null) return null;
  const category = categories[food];
  return knownNames.has(food) &&
    category?.categoryId === categoryId &&
    !category.uncertain
    ? food
    : null;
}

export function schemaToWeekPlan(
  calculation: Extract<SchemaCalculation, { ok: true }>,
): { plan: WeekPlan; skipped: SkippedPortion[] } {
  const skipped: SkippedPortion[] = [];
  const plan: WeekPlan = {
    days: schemaDays.map((day) => {
      function portion(
        key: RepresentativeKey,
        grams: number,
        meal: string,
      ): PlannedPortion[] {
        const food = representative(key);
        if (food === null)
          throw new Error(`Alimento rappresentativo non disponibile: ${key}`);
        return [{ id: `schema-${day}-${meal}-${key}`, food, grams }];
      }
      function protein(
        choice: SchemaProteinPortion | null,
        meal: "lunch" | "dinner",
      ): PlannedPortion[] {
        if (choice === null) return [];
        const food = representative(choice.source);
        const reason =
          food === null
            ? "Nessun alimento rappresentativo con categoria certa disponibile"
            : choice.quantity === null
              ? "manca la quantità base di carne rossa"
              : null;
        if (reason !== null) {
          skipped.push({ day, meal, source: choice.source, reason });
          return [];
        }
        return portion(choice.source, choice.quantity?.value ?? 0, meal);
      }
      const choices = calculation.proteinWeek.days.find(
        (entry) => entry.day === day,
      );
      function mainMeal(meal: "lunch" | "dinner"): PlannedPortion[] {
        const key = meal === "lunch" ? "pasta" : "bread";
        const grams = calculation.carbohydrates[meal][key]?.value;
        if (grams === undefined)
          throw new Error(`Quantità carboidrati non disponibile: ${key}`);
        return [
          ...portion(key, grams, meal),
          ...protein(choices?.[meal] ?? null, meal),
          ...portion("vegetables", 200, meal),
          ...portion("fruit", 150, meal),
          ...portion("oil", OIL_ML_PER_MEAL * OIL_GRAMS_PER_ML, meal),
        ];
      }
      const breakfast = calculation.breakfast;
      return {
        included: true,
        meals: [
          portion(
            breakfast.choice,
            breakfast.quantity.value *
              (breakfast.choice === "latte" ? MILK_GRAMS_PER_ML : 1),
            "breakfast",
          ),
          portion("nuts", calculation.snacks.nuts.value, "morningSnack"),
          mainMeal("lunch"),
          portion("yogurt", calculation.snacks.yogurt.value, "afternoonSnack"),
          mainMeal("dinner"),
          [],
        ],
      };
    }),
  };
  return { plan, skipped };
}

/** Includes zero-gram and unknown-food portions, even on excluded days. */
export function isWeekPlanNonEmpty(plan: WeekPlan): boolean {
  return plan.days.some((day) => !isDayEmpty(day));
}
