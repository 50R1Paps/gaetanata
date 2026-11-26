import { expect, it } from "vitest";
import { emptySchema } from "./schema";
import { calculateSchema } from "./schemaCalc";

const patient = {
  name: "Esempio",
  birthDate: "1986-01-01",
  sex: "male" as const,
  weightKg: 80,
  heightCm: 180,
};
const today = "2026-01-01";

it("keeps v1 drafts valid and supplies independent manual defaults without inventing a protein rotation", () => {
  const result = calculateSchema(
    patient,
    { ...emptySchema(), kcal: 2000 },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.proteinWeek.days).toHaveLength(7);
  expect(
    result.proteinWeek.days.every(
      (day) => day.lunch === null && day.dinner === null,
    ),
  ).toBe(true);
  expect(result.pizza).toEqual({
    bread: { calculated: 50, value: 50, overridden: false },
    oil: { calculated: 10, value: 10, overridden: false },
    whiteMeat: null,
    fish: null,
  });
  expect(result.breakfast).toEqual({
    choice: "latte",
    unit: "ml",
    quantity: { calculated: 150, value: 150, overridden: false },
  });
  expect(result.snacks.nuts.value).toBe(20);
  expect(result.snacks.yogurt.value).toBe(125);
});

it("calculates all protein sources, manual corrections and exception portions, recalculating ratios with the entered base", () => {
  const schema = {
    ...emptySchema(),
    kcal: 2000,
    proteinWeek: {
      redMeatGrams: 115,
      days: {
        lunedi: {
          lunch: { source: "uova" as const },
          dinner: { source: "pesce_scatola" as const },
        },
        martedi: {
          lunch: { source: "legumi_secchi" as const },
          dinner: { source: "legumi_scatola" as const },
        },
        mercoledi: {
          lunch: { source: "formaggio_fresco" as const },
          dinner: { source: "formaggio_stagionato" as const },
        },
        giovedi: {
          lunch: { source: "affettati" as const },
          dinner: { source: "carne_rossa" as const },
        },
        venerdi: {
          lunch: { source: "carne_bianca" as const },
          dinner: { source: "pesce" as const },
        },
        sabato: {
          lunch: { source: "uova" as const, exception: true },
          dinner: { source: "pesce_scatola" as const, exception: true },
        },
        domenica: {
          lunch: { source: "carne_bianca" as const, grams: 0 },
          dinner: { source: "pesce" as const, grams: 190 },
        },
      },
    },
  };
  const result = calculateSchema(patient, schema, today);
  if (!result.ok) throw new Error("Expected calculation");
  expect(
    result.proteinWeek.days.flatMap((day) => [
      day.lunch?.quantity?.value,
      day.dinner?.quantity?.value,
    ]),
  ).toEqual([120, 52, 50, 150, 100, 50, 80, 115, 150, 175, 180, 78, 0, 190]);
  const changed = calculateSchema(
    patient,
    { ...schema, proteinWeek: { ...schema.proteinWeek, redMeatGrams: 100 } },
    today,
  );
  if (!changed.ok) throw new Error("Expected calculation");
  expect(changed.proteinWeek.days[4]?.lunch?.quantity?.value).toBe(130);
  expect(changed.proteinWeek.days[4]?.dinner?.quantity?.value).toBe(150);
  expect(changed.proteinWeek.days[6]?.dinner?.quantity).toEqual({
    calculated: 150,
    value: 190,
    overridden: true,
  });
  const missingBase = calculateSchema(
    patient,
    { ...schema, proteinWeek: { days: schema.proteinWeek.days } },
    today,
  );
  if (!missingBase.ok) throw new Error("Expected calculation");
  expect(missingBase.proteinWeek.days[4]?.lunch?.quantity).toBeNull();
  expect(missingBase.proteinWeek.days[6]?.dinner?.quantity).toEqual({
    calculated: null,
    value: 190,
    overridden: true,
  });
});

it("counts choices by source and compares combined cheese/legume groups to inclusive recommendations", () => {
  const result = calculateSchema(
    patient,
    {
      ...emptySchema(),
      kcal: 2000,
      proteinWeek: {
        days: {
          lunedi: {
            lunch: { source: "formaggio_fresco" },
            dinner: { source: "formaggio_stagionato" },
          },
          martedi: {
            lunch: { source: "legumi_secchi" },
            dinner: { source: "legumi_scatola" },
          },
          mercoledi: {
            lunch: { source: "pesce" },
            dinner: { source: "pesce" },
          },
          giovedi: {
            lunch: { source: "pesce_scatola", exception: true },
            dinner: { source: "uova" },
          },
          venerdi: {
            lunch: { source: "carne_bianca" },
            dinner: { source: "carne_bianca" },
          },
          sabato: {
            lunch: { source: "affettati" },
            dinner: { source: "affettati" },
          },
        },
      },
    },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.proteinWeek.counts.formaggio_fresco).toBe(1);
  expect(result.proteinWeek.counts.formaggio_stagionato).toBe(1);
  expect(
    result.proteinWeek.frequencies.map(
      ({ key, count, min, max, outOfRange }) => [
        key,
        count,
        min,
        max,
        outOfRange,
      ],
    ),
  ).toEqual([
    ["carne_bianca", 2, 2, 4, false],
    ["carne_rossa", 0, 0, 1, false],
    ["pesce", 2, 2, 4, false],
    ["formaggi", 2, 1, 2, false],
    ["pesce_scatola", 1, 1, 2, false],
    ["affettati", 2, 0, 1, true],
    ["uova", 1, 1, 2, false],
    ["legumi", 2, 2, 4, false],
  ]);
  const empty = calculateSchema(
    patient,
    { ...emptySchema(), kcal: 2000 },
    today,
  );
  if (!empty.ok) throw new Error("Expected calculation");
  expect(
    empty.proteinWeek.frequencies.find((f) => f.key === "pesce")?.outOfRange,
  ).toBe(true);
});

it("uses manual pizza, breakfast and snack quantities without scaling them with kcal or meal count", () => {
  for (const kcal of [1200, 2400]) {
    const result = calculateSchema(
      patient,
      {
        ...emptySchema(),
        kcal,
        mealCount: 3,
        pizza: { breadGrams: 75, oilMl: 0 },
        breakfast: { choice: "yogurt", quantity: 170 },
        snacks: { nutsGrams: 30, yogurtGrams: 200 },
      },
      today,
    );
    if (!result.ok) throw new Error("Expected calculation");
    expect(result.pizza).toEqual({
      bread: { calculated: 50, value: 75, overridden: true },
      oil: { calculated: 10, value: 0, overridden: true },
      whiteMeat: null,
      fish: null,
    });
    expect(result.breakfast).toEqual({
      choice: "yogurt",
      unit: "g",
      quantity: { calculated: 125, value: 170, overridden: true },
    });
    expect(result.snacks.nuts.value).toBe(30);
    expect(result.snacks.yogurt.value).toBe(200);
  }
  const result = calculateSchema(
    patient,
    { ...emptySchema(), kcal: 2000, breakfast: { choice: "yogurt" } },
    today,
  );
  if (!result.ok) throw new Error("Expected calculation");
  expect(result.breakfast.quantity.value).toBe(125);
});

it("recalculates pizza meat and fish like weekdays, preserves manual zero and restores deleted overrides", () => {
  const schema = {
    ...emptySchema(),
    kcal: 1800,
    proteinWeek: { redMeatGrams: 115 },
  };
  const proposed = calculateSchema(patient, schema, today);
  if (!proposed.ok) throw new Error("Expected calculation");
  expect(proposed.pizza.whiteMeat).toEqual({
    calculated: 150,
    value: 150,
    overridden: false,
  });
  expect(proposed.pizza.fish).toEqual({
    calculated: 175,
    value: 175,
    overridden: false,
  });
  const corrected = calculateSchema(
    patient,
    { ...schema, pizza: { whiteMeatGrams: 0, fishGrams: 190 } },
    today,
  );
  if (!corrected.ok) throw new Error("Expected calculation");
  expect(corrected.pizza.whiteMeat).toEqual({
    calculated: 150,
    value: 0,
    overridden: true,
  });
  expect(corrected.pizza.fish).toEqual({
    calculated: 175,
    value: 190,
    overridden: true,
  });
  const restored = calculateSchema(
    patient,
    { ...schema, proteinWeek: { redMeatGrams: 100 }, pizza: {} },
    today,
  );
  if (!restored.ok) throw new Error("Expected calculation");
  expect(restored.pizza.whiteMeat?.value).toBe(130);
  expect(restored.pizza.fish?.value).toBe(150);
  const manual = calculateSchema(
    patient,
    {
      ...schema,
      proteinWeek: {},
      pizza: { whiteMeatGrams: 120, fishGrams: 0 },
    },
    today,
  );
  if (!manual.ok) throw new Error("Expected calculation");
  expect(manual.pizza.whiteMeat).toEqual({
    calculated: null,
    value: 120,
    overridden: true,
  });
  expect(manual.pizza.fish).toEqual({
    calculated: null,
    value: 0,
    overridden: true,
  });
});
