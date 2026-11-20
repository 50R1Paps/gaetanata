import { expect, it } from "vitest";
import { emptySchema } from "./schema";
import {
  calculateSchema,
  cookedSchemaGrams,
  roundSchemaGrams,
} from "./schemaCalc";

const patient = {
  name: "Prova",
  birthDate: "1986-01-01",
  sex: "male" as const,
  weightKg: 80,
  heightCm: 180,
};
const today = "2026-01-01";

it("reproduces the sheet's 60 g carbohydrate substitutions and keeps dinner equal to lunch", () => {
  const schema = { ...emptySchema(), kcal: 1280 };
  const result = calculateSchema(patient, schema, today);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.meals.map((m) => [m.slot, m.percent])).toEqual([
    ["breakfast", 20],
    ["morningSnack", 5],
    ["lunch", 40],
    ["afternoonSnack", 5],
    ["dinner", 30],
  ]);
  expect(
    result.meals.find((m) => m.slot === "lunch")?.grams.carbohydrates.value,
  ).toBe(55);
  expect(
    result.meals.find((m) => m.slot === "dinner")?.grams.carbohydrates.value,
  ).toBe(55);
  const sixty = calculateSchema(
    patient,
    { ...schema, kcal: 1371.4285714285713 },
    today,
  );
  if (!sixty.ok) throw new Error("Expected valid schema");
  expect(sixty.carbohydrates.lunch.pasta).toMatchObject({
    calculated: 80,
    value: 80,
    overridden: false,
  });
  expect(sixty.carbohydrates.dinner.bread?.value).toBe(110);
  expect(sixty.carbohydrates.lunch.potatoes?.value).toBe(355);
});

it.each([
  [3, [20, 45, 35]],
  [4, [20, 40, 10, 30]],
  [5, [20, 5, 40, 5, 30]],
  [6, [15, 5, 35, 5, 35, 5]],
] as const)(
  "allocates %i meals and rounds macro grams, not calories",
  (mealCount, percentages) => {
    const result = calculateSchema(
      patient,
      { ...emptySchema(), kcal: 2000, mealCount },
      today,
    );
    if (!result.ok) throw new Error("Expected calculation");
    expect(result.meals.map((m) => m.percent)).toEqual(percentages);
    expect(result.meals.reduce((sum, m) => sum + m.kcal, 0)).toBe(2000);
    for (const meal of result.meals)
      for (const grams of Object.values(meal.grams))
        expect(grams.value % 5).toBe(0);
    expect(roundSchemaGrams(12.49)).toBe(10);
    expect(roundSchemaGrams(12.5)).toBe(15);
    expect(cookedSchemaGrams("pasta", 80)).toBe(160);
    expect(cookedSchemaGrams("rice", 80)).toBe(200);
  },
);

it("derives additional substitutions from the food table, not invented sheet coefficients", () => {
  const result = calculateSchema(
    patient,
    { ...emptySchema(), kcal: 1371.4285714285713 },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.carbohydrates.lunch.gnocchi?.value).toBe(160);
  expect(result.carbohydrates.dinner.riceCakes?.value).toBe(75);
  expect(result.carbohydrates.dinner.crackers?.value).toBe(80);
  expect(result.carbohydrates.lunch.pastaAndBreadPasta?.value).toBe(40);
  expect(result.carbohydrates.lunch.pastaAndBreadBread?.value).toBe(55);
  expect(result.carbohydrates.lunch.cornmeal).toBeNull();
  expect(result.warnings).toContainEqual({
    code: "substitution-unavailable",
    substitution: "cornmeal",
  });
});

it("applies manual grams without hiding calculated values and undoes by removing keys", () => {
  const schema = {
    ...emptySchema(),
    kcal: 2000,
    laf: 1.8,
    macroPercent: { carbohydrates: 40, fat: 30, protein: 30 },
    overrides: {
      meals: { lunch: { carbohydrates: 60, protein: 0 } },
      carbohydrates: { lunch: { pasta: 92 } },
    },
  };
  const result = calculateSchema(patient, schema, today);
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.fabbisogno).toBeCloseTo(result.metabolism.kcal * 1.8);
  expect(result.meals.find((m) => m.slot === "lunch")?.grams.protein).toEqual({
    calculated: 60,
    value: 0,
    overridden: true,
  });
  expect(result.carbohydrates.lunch.pasta).toEqual({
    calculated: 80,
    value: 92,
    overridden: true,
  });
  expect(result.protein.grams).toBe(90);
  const restored = calculateSchema(
    patient,
    { ...schema, overrides: {} },
    today,
  );
  if (!restored.ok) throw new Error("Expected calculation");
  expect(restored.carbohydrates.lunch.pasta?.overridden).toBe(false);
  expect(restored.protein.grams).toBe(150);
});

it("reports real and every ideal protein ratio, with inclusive warning limits", () => {
  const result = calculateSchema(
    patient,
    { ...emptySchema(), kcal: 2000 },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.protein.grams).toBe(100);
  expect(result.protein.real).toBe(1.25);
  expect(result.protein.ideal.bmi225.weightKg).toBeCloseTo(72.9);
  expect(result.protein.ideal.bmi225.gramsPerKg).toBeCloseTo(1.371742);
  expect(result.protein.ideal.bmi25.weightKg).toBe(81);
  expect(result.protein.ideal.lorenz.weightKg).toBe(72.5);
  expect(
    result.warnings.filter((w) => w.code !== "substitution-unavailable"),
  ).toEqual([]);
  for (const [kcal, code] of [
    [1600, "protein-low"],
    [2400, "protein-high"],
  ] as const) {
    const outside = calculateSchema(patient, { ...emptySchema(), kcal }, today);
    if (!outside.ok) throw new Error("Expected calculation");
    expect(outside.warnings).toContainEqual({
      code,
      basis: "real",
      value: kcal === 1600 ? 1 : 1.5,
    });
  }
  for (const kcal of [1920, 2240]) {
    const edge = calculateSchema(patient, { ...emptySchema(), kcal }, today);
    if (!edge.ok) throw new Error("Expected calculation");
    expect(edge.warnings.some((w) => "basis" in w && w.basis === "real")).toBe(
      false,
    );
  }
});

it("returns only actionable issues, never numbers, for missing or invalid inputs", () => {
  const result = calculateSchema(
    { ...patient, birthDate: null, sex: null, weightKg: null, heightCm: null },
    emptySchema(),
    today,
  );
  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.issues.map((issue) => issue.field)).toEqual([
    "birthDate",
    "sex",
    "weightKg",
    "heightCm",
    "kcal",
  ]);
  expect(Object.keys(result)).toEqual(["ok", "issues"]);
  for (const data of [
    { ...patient, weightKg: -1 },
    { ...patient, birthDate: "2030-01-01" },
    { ...patient, heightCm: 10 },
  ]) {
    expect(
      calculateSchema(data, { ...emptySchema(), kcal: 2000 }, today).ok,
    ).toBe(false);
  }
  expect(
    calculateSchema(
      patient,
      {
        ...emptySchema(),
        kcal: 2000,
        macroPercent: { carbohydrates: 50, fat: 50, protein: 20 },
      },
      today,
    ).ok,
  ).toBe(false);
});

it("replaces unrounded protein allocations when all meal grams are overridden", () => {
  const result = calculateSchema(
    patient,
    {
      ...emptySchema(),
      kcal: 150,
      mealCount: 3,
      overrides: {
        meals: {
          breakfast: { protein: 0 },
          lunch: { protein: 0 },
          dinner: { protein: 0 },
        },
      },
    },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.protein.grams).toBe(0);
});

it("rejects non-calendar calculation dates", () => {
  expect(
    calculateSchema(patient, { ...emptySchema(), kcal: 2000 }, "2026-02-31").ok,
  ).toBe(false);
});
