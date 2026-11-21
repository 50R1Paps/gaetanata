import { expect, it } from "vitest";
import foodSchema from "./data/food-schema.json" with { type: "json" };
import foods from "./data/foods.json" with { type: "json" };
import {
  addPortion,
  emptyWeekPlan,
  resolvePlan,
  setDayIncluded,
} from "./plan.ts";
import { emptySchema } from "./schema.ts";
import { calculateSchema } from "./schemaCalc.ts";
import {
  isWeekPlanNonEmpty,
  schemaRepresentativeFoods,
  schemaToWeekPlan,
} from "./schemaToPlan.ts";

const patient = {
  name: "Prova",
  birthDate: "1986-01-01",
  sex: "male" as const,
  weightKg: 80,
  heightCm: 180,
};

it("converts seven days with effective quantities, fixed sides and equal oil shares, not pizza", () => {
  const calculation = calculateSchema(
    patient,
    {
      ...emptySchema(),
      kcal: 1600,
      breakfast: { choice: "latte", quantity: 200 },
      snacks: { nutsGrams: 25, yogurtGrams: 150 },
      overrides: {
        carbohydrates: { lunch: { pasta: 85 }, dinner: { bread: 115 } },
      },
      proteinWeek: {
        days: { lunedi: { lunch: { source: "uova", exception: true } } },
      },
      pizza: { breadGrams: 999, oilMl: 999 },
    },
    "2026-01-01",
  );
  if (!calculation.ok) throw new Error("Expected valid calculation");
  const { plan, skipped } = schemaToWeekPlan(calculation);
  expect(skipped).toEqual([]);
  expect(plan.days).toHaveLength(7);
  for (const day of plan.days) {
    expect(day.included).toBe(true);
    expect(day.meals).toHaveLength(6);
    expect(day.meals[0]).toMatchObject([
      { food: "Latte parzialmente scremato UHT", grams: 206 },
    ]);
    expect(day.meals[1]).toMatchObject([{ food: "Mandorle", grams: 25 }]);
    expect(day.meals[3]).toMatchObject([
      { food: "yogurt magro (Vipiteno)", grams: 150 },
    ]);
    expect(day.meals[5]).toEqual([]);
  }
  expect(plan.days[0]?.meals[2]).toMatchObject([
    { food: "Pasta di semola", grams: 85 },
    { food: "Uova", grams: 180 },
    { food: "Zucchine", grams: 200 },
    { food: "Mela con buccia", grams: 150 },
    { food: "Olio EVO", grams: 13.8 },
  ]);
  expect(plan.days[0]?.meals[4]).toMatchObject([
    { food: "Pane bianco", grams: 115 },
    { food: "Zucchine", grams: 200 },
    { food: "Mela con buccia", grams: 150 },
    { food: "Olio EVO", grams: 13.8 },
  ]);
  const resolved = resolvePlan(plan, (name) =>
    foods.find((food) => food.name === name),
  );
  expect(resolved.issues).toEqual([]);
  expect(resolved.averageIncomplete).toBe(false);
  expect(resolved.average?.caloriesKcal).toBeGreaterThan(0);
  const ids = plan.days.flatMap((day) =>
    day.meals.flatMap((meal) => meal.map((portion) => portion.id)),
  );
  expect(new Set(ids).size).toBe(ids.length);
});

it("detects existing portions even when zero grams or on an excluded day", () => {
  const empty = emptyWeekPlan();
  expect(isWeekPlanNonEmpty(empty)).toBe(false);
  const filled = addPortion(empty, 6, 5, {
    id: "existing",
    food: "Unknown",
    grams: 0,
  });
  expect(isWeekPlanNonEmpty(setDayIncluded(filled, 6, false))).toBe(true);
});

it("uses only existing, certain representatives of the expected category", () => {
  const categories: Record<
    string,
    { categoryId: string | null; uncertain: boolean }
  > = foodSchema.foods;
  for (const [key, entry] of Object.entries(schemaRepresentativeFoods)) {
    if (entry.food === null) {
      expect(key).toBe("legumi_scatola");
      expect(
        Object.values(categories).some(
          (category) =>
            category.categoryId === entry.categoryId && !category.uncertain,
        ),
      ).toBe(false);
      continue;
    }
    expect(foods.some((food) => food.name === entry.food)).toBe(true);
    expect(categories[entry.food]).toMatchObject({
      categoryId: entry.categoryId,
      uncertain: false,
    });
  }
});

it("converts all available protein sources, preserving overrides and reporting missing representatives or quantities", () => {
  const calculation = calculateSchema(
    patient,
    {
      ...emptySchema(),
      kcal: 1800,
      proteinWeek: {
        redMeatGrams: 100,
        days: {
          lunedi: {
            lunch: { source: "carne_rossa" },
            dinner: { source: "carne_bianca" },
          },
          martedi: { lunch: { source: "pesce" }, dinner: { source: "uova" } },
          mercoledi: {
            lunch: { source: "legumi_secchi" },
            dinner: { source: "legumi_scatola" },
          },
          giovedi: {
            lunch: { source: "formaggio_fresco" },
            dinner: { source: "formaggio_stagionato" },
          },
          venerdi: {
            lunch: { source: "affettati" },
            dinner: { source: "pesce_scatola", exception: true },
          },
          sabato: {
            lunch: { source: "pesce", grams: 177 },
            dinner: { source: "uova", grams: 0 },
          },
        },
      },
    },
    "2026-01-01",
  );
  if (!calculation.ok) throw new Error("Expected valid calculation");
  const before = JSON.stringify(calculation);
  const converted = schemaToWeekPlan(calculation);
  expect(converted.skipped).toEqual([
    {
      day: "mercoledi",
      meal: "dinner",
      source: "legumi_scatola",
      reason: "Nessun alimento rappresentativo con categoria certa disponibile",
    },
  ]);
  const proteins = converted.plan.days.map((day) =>
    [2, 4].map((meal) => {
      const portions = day.meals[meal];
      return portions?.length === 5
        ? [portions[1]?.food, portions[1]?.grams]
        : null;
    }),
  );
  expect(proteins).toEqual([
    [
      ["Carne manzo", 100],
      ["Pollo petto (crudo)", 130],
    ],
    [
      ["Merluzzo", 150],
      ["Uova", 120],
    ],
    [["Lenticchie, secche", 50], null],
    [
      ["Ricotta", 100],
      ["Grana", 50],
    ],
    [
      ["Prosciutto cotto", 80],
      ["Tonno (in scatola)", 78],
    ],
    [
      ["Merluzzo", 177],
      ["Uova", 0],
    ],
    [null, null],
  ]);
  expect(
    resolvePlan(converted.plan, (name) =>
      foods.find((food) => food.name === name),
    ).issues,
  ).toEqual([]);
  expect(schemaToWeekPlan(calculation)).toEqual(converted);
  expect(JSON.stringify(calculation)).toBe(before);

  const missing = calculateSchema(
    patient,
    {
      ...emptySchema(),
      kcal: 1800,
      proteinWeek: { days: { domenica: { dinner: { source: "pesce" } } } },
    },
    "2026-01-01",
  );
  if (!missing.ok) throw new Error("Expected valid calculation");
  expect(schemaToWeekPlan(missing).skipped).toEqual([
    {
      day: "domenica",
      meal: "dinner",
      source: "pesce",
      reason: "manca la quantità base di carne rossa",
    },
  ]);
});

it.each([3, 4, 5, 6] as const)(
  "keeps manual snacks for %i meals and yogurt breakfast in grams",
  (mealCount) => {
    const calculation = calculateSchema(
      patient,
      {
        ...emptySchema(),
        kcal: 1800,
        mealCount,
        breakfast: { choice: "yogurt", quantity: 140 },
        snacks: { nutsGrams: 0, yogurtGrams: 80 },
      },
      "2026-01-01",
    );
    if (!calculation.ok) throw new Error("Expected valid calculation");
    const { plan } = schemaToWeekPlan(calculation);
    expect(plan.days[0]?.meals[0]).toMatchObject([
      { food: "yogurt magro (Vipiteno)", grams: 140 },
    ]);
    expect(plan.days[0]?.meals[1]).toMatchObject([
      { food: "Mandorle", grams: 0 },
    ]);
    expect(plan.days[0]?.meals[3]).toMatchObject([
      { food: "yogurt magro (Vipiteno)", grams: 80 },
    ]);
  },
);
