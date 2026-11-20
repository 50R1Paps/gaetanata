import { describe, expect, it } from "vitest";
import foods from "../data/foods.json";
import {
  activityCalories,
  activityLevel,
  ageAt,
  basalMetabolism,
  bernstein,
  bmi,
  dayTotal,
  formulaForBmi,
  harrisBenedict,
  idealWeights,
  macroCalories,
  mealTotal,
  mifflinStJeor,
  portionNutrients,
  weeklyAverage,
} from "./index";

function food(name: string) {
  const result = foods.find((item) => item.name === name);
  if (!result) throw new Error(`Missing food: ${name}`);
  return result;
}

const milk = { food: food("Latte parzialmente scremato UHT"), grams: 150 };
const breakfast = [
  milk,
  { food: food("Fette biscottate"), grams: 32 },
  { food: food("Noci"), grams: 15 },
];

describe("workbook calculations", () => {
  it("calculates age using Excel's 365.25-day approximation", () => {
    expect(ageAt(new Date("2000-01-01"), new Date("2024-01-01"))).toBe(24);
    expect(ageAt(new Date("2000-01-01"), new Date("2023-12-31"))).toBe(23);
  });

  it("matches cached BMI and ideal weights and deltas", () => {
    expect(bmi(72.5, 156)).toBeCloseTo(29.79125575, 8);
    const ideal = idealWeights(156, 72.5, "female");
    expect(ideal.bmi225.weight).toBeCloseTo(54.756);
    expect(ideal.bmi25.weight).toBeCloseTo(60.84);
    expect(ideal.lorenz.weight).toBe(53);
    expect(ideal.bmi225.delta).toBeCloseTo(-17.744);
    expect(ideal.bmi25.delta).toBeCloseTo(-11.66);
    expect(ideal.lorenz.delta).toBe(-19.5);
    expect(idealWeights(156, 72.5, "male").lorenz.weight).toBe(54.5);
  });

  it("calculates female basal metabolism and selects the BMI formula", () => {
    const result = basalMetabolism({
      sex: "female",
      weightKg: 72.5,
      heightCm: 156,
      age: 58,
    });
    expect(result.formulas.harrisBenedict).toBeCloseTo(1365.7948, 4);
    expect(result.formulas.mifflinStJeor).toBeCloseTo(1252.915, 3);
    expect(result.formulas.bernstein).toBeCloseTo(1146.78, 2);
    expect(result.formula).toBe("mifflinStJeor");
    expect(result.kcal).toBe(result.formulas.mifflinStJeor);
  });

  it("calculates each male basal metabolism formula", () => {
    // 66.473 + 13.7516 * 80 + 5.0033 * 180 - 6.755 * 40 = 1796.995
    expect(harrisBenedict("male", 80, 180, 40)).toBeCloseTo(1796.995, 3);
    // 9.99 * 80 + 6.25 * 180 - 4.92 * 40 + 5 = 1732.4
    expect(mifflinStJeor("male", 80, 180, 40)).toBeCloseTo(1732.4, 3);
    // 11.02 * 80 + 10.23 * 180 - 5.8 * 40 - 1032 = 1459
    expect(bernstein("male", 80, 180, 40)).toBeCloseTo(1459, 3);
  });

  it("selects a basal metabolism formula at BMI thresholds", () => {
    expect(formulaForBmi(25)).toBe("harrisBenedict");
    expect(formulaForBmi(25.01)).toBe("mifflinStJeor");
    expect(formulaForBmi(30)).toBe("mifflinStJeor");
    expect(formulaForBmi(30.01)).toBe("bernstein");
  });

  it("matches the cached breakfast and its individual portions", () => {
    const milkNutrients = portionNutrients(milk);
    expect(milkNutrients.caloriesKcal).toBeCloseTo(69);
    expect(milkNutrients.carbohydratesG).toBeCloseTo(7.65);
    expect(milkNutrients.fatG).toBeCloseTo(2.4);
    expect(milkNutrients.proteinG).toBeCloseTo(4.8);
    const total = mealTotal(breakfast);
    expect(total.caloriesKcal).toBeCloseTo(290.94);
    expect(total.carbohydratesG).toBeCloseTo(33.7065);
    expect(total.fatG).toBeCloseTo(14.1015);
    expect(total.proteinG).toBeCloseTo(10.7005);
    expect(total.saturatedFatG).toBeCloseTo(0.9189);
    expect(dayTotal([breakfast, [], [], [], [], []])).toEqual(total);
  });

  it("calculates intended macro shares of total macro calories", () => {
    const macros = macroCalories(mealTotal(breakfast));
    expect(macros.total).toBeCloseTo(304.5415);
    expect(macros.percentages.carbohydrates).toBeCloseTo(44.27179875);
    expect(
      macros.percentages.fat +
        macros.percentages.protein +
        macros.percentages.carbohydrates,
    ).toBeCloseTo(100);
    expect(macroCalories(mealTotal([])).percentages.fat).toBe(0);
  });

  it("averages included days only", () => {
    const first = mealTotal(breakfast);
    const second = mealTotal([{ food: food("Noci"), grams: 15 }]);
    const excluded = mealTotal([{ food: food("Noci"), grams: 500 }]);
    const average = weeklyAverage([
      { total: first, included: true },
      { total: excluded, included: false },
      { total: second, included: true },
    ]);
    expect(average?.caloriesKcal).toBeCloseTo(194.52);
    expect(average?.carbohydratesG).toBeCloseTo(17.8815);
    expect(weeklyAverage([{ total: first, included: false }])).toBeNull();
  });

  it("matches cached activity calories and LAF", () => {
    const activities = [
      [1, 4, "Ore"],
      [0.9, 7, "Ore"],
      [1.5, 5, "Ore"],
      [2, 15, "Minuti"],
      [2.3, 30, "Minuti"],
      [1.8, 1, "Ore"],
      [8.3, 10, "Minuti"],
      [2, 1, "Ore"],
      [2, 2.5, "Ore"],
      [1, 1.5, "Ore"],
      [1.3, 1.1, "Ore"],
    ] as const;
    const calories = activities.map(([met, quantity, unit]) =>
      activityCalories(met, 72.5, quantity, unit),
    );
    expect(calories[0]).toBe(290);
    expect(calories[1]).toBe(456.75);
    expect(calories[3]).toBe(36.25);
    expect(
      activityLevel(
        calories.reduce((sum, value) => sum + value, 0),
        1249,
      ),
    ).toBeCloseTo(1.890185482, 8);
  });
});
