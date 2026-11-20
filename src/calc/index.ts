import foodData from "../data/foods.json";
import type metData from "../data/met.json";

/** Nutrient keys end in G (grams), Mg (milligrams), Mcg (micrograms), or Kcal.
 * Food nutrient values are per 100 g; null means the source has no usable value. */
export type NutrientKey = Exclude<
  keyof (typeof foodData)[number],
  "name" | "referenceGrams"
>;
export type Nutrients = Record<NutrientKey, number>;
export type Food = { name: string; referenceGrams: number | null } & Record<
  NutrientKey,
  number | null
>;
export type MetActivity = (typeof metData)[number];
export type Portion = { food: Food; grams: number };
export type Meal = readonly Portion[];
export type Day = readonly [Meal, Meal, Meal, Meal, Meal, Meal];
export const mealSlots = [
  "Colazione",
  "Spuntini",
  "Pranzo",
  "Merenda",
  "Cena",
  "Dopocena",
] as const;

export function ageAt(birthDate: Date, today: Date): number {
  const day = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return Math.floor((day(today) - day(birthDate)) / 86_400_000 / 365.25);
}

export function bmi(weightKg: number, heightCm: number): number {
  return weightKg / (heightCm / 100) ** 2;
}

/** Harris and Benedict, "A Biometric Study of Human Basal Metabolism" (1918). */
export function harrisBenedict(
  sex: "male" | "female",
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  return sex === "male"
    ? 66.473 + 13.7516 * weightKg + 5.0033 * heightCm - 6.755 * age
    : 655.0955 + 9.5634 * weightKg + 1.8496 * heightCm - 4.6756 * age;
}

/** Mifflin et al., "A new predictive equation for resting energy expenditure in healthy individuals" (1990). */
export function mifflinStJeor(
  sex: "male" | "female",
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  return (
    9.99 * weightKg + 6.25 * heightCm - 4.92 * age + (sex === "male" ? 5 : -161)
  );
}

/** Bernstein et al., "Prediction of the resting metabolic rate in obese patients" (1983). */
export function bernstein(
  sex: "male" | "female",
  weightKg: number,
  heightCm: number,
  age: number,
): number {
  return sex === "male"
    ? 11.02 * weightKg + 10.23 * heightCm - 5.8 * age - 1032
    : 7.48 * weightKg - 0.42 * heightCm - 3 * age + 844;
}

export function formulaForBmi(
  bmi: number,
): "harrisBenedict" | "mifflinStJeor" | "bernstein" {
  return bmi <= 25
    ? "harrisBenedict"
    : bmi <= 30
      ? "mifflinStJeor"
      : "bernstein";
}

export function basalMetabolism({
  sex,
  weightKg,
  heightCm,
  age,
}: {
  sex: "male" | "female";
  weightKg: number;
  heightCm: number;
  age: number;
}) {
  const formulas = {
    harrisBenedict: harrisBenedict(sex, weightKg, heightCm, age),
    mifflinStJeor: mifflinStJeor(sex, weightKg, heightCm, age),
    bernstein: bernstein(sex, weightKg, heightCm, age),
  };
  const formula = formulaForBmi(bmi(weightKg, heightCm));
  return { formula, kcal: formulas[formula], formulas };
}

export function idealWeights(
  heightCm: number,
  weightKg: number,
  sex: "male" | "female",
) {
  const heightSquared = (heightCm / 100) ** 2;
  const bmi225 = 22.5 * heightSquared;
  const bmi25 = 25 * heightSquared;
  const lorenz = heightCm - 100 - (heightCm - 150) / (sex === "male" ? 4 : 2);
  return {
    bmi225: { weight: bmi225, delta: bmi225 - weightKg },
    bmi25: { weight: bmi25, delta: bmi25 - weightKg },
    lorenz: { weight: lorenz, delta: lorenz - weightKg },
  };
}

const nutrientKeys = Object.keys(foodData[0] ?? {}).filter(
  (key): key is NutrientKey => key !== "name" && key !== "referenceGrams",
);

function zeroNutrients(): Nutrients {
  return Object.fromEntries(nutrientKeys.map((key) => [key, 0])) as Nutrients;
}

export function portionNutrients({ food, grams }: Portion): Nutrients {
  const result = zeroNutrients();
  for (const key of nutrientKeys)
    result[key] = ((food[key] ?? 0) * grams) / 100;
  return result;
}

function sumNutrients(values: readonly Nutrients[]): Nutrients {
  const result = zeroNutrients();
  for (const value of values) {
    for (const key of nutrientKeys) result[key] += value[key];
  }
  return result;
}

export function mealTotal(meal: Meal): Nutrients {
  return sumNutrients(meal.map(portionNutrients));
}

export function dayTotal(day: Day): Nutrients {
  return sumNutrients(day.map(mealTotal));
}

export function macroCalories(nutrients: Nutrients) {
  const carbohydrates = nutrients.carbohydratesG * 4;
  const fat = nutrients.fatG * 9;
  const protein = nutrients.proteinG * 4;
  const total = carbohydrates + fat + protein;
  return {
    total,
    carbohydrates,
    fat,
    protein,
    percentages: {
      carbohydrates: total === 0 ? 0 : (carbohydrates / total) * 100,
      fat: total === 0 ? 0 : (fat / total) * 100,
      protein: total === 0 ? 0 : (protein / total) * 100,
    },
  };
}

/** Excel AVERAGE has no result when no days are included. */
export function weeklyAverage(
  days: readonly { total: Nutrients; included: boolean }[],
): Nutrients | null {
  const included = days.filter((day) => day.included);
  if (included.length === 0) return null;
  const result = sumNutrients(included.map((day) => day.total));
  for (const key of nutrientKeys) result[key] /= included.length;
  return result;
}

export function activityCalories(
  met: number,
  weightKg: number,
  quantity: number,
  unit: "Ore" | "Minuti",
): number {
  return met * weightKg * (unit === "Minuti" ? quantity / 60 : quantity);
}

export function activityLevel(totalActivityKcal: number, bmr: number): number {
  return totalActivityKcal / bmr;
}
