import { describe, expect, it } from "vitest";
import { mealSlots } from "./calc";
import { findFood, lookupFood, searchFoods } from "./foods";
import { formatNumber, formatNutrient, parseGrams } from "./format";
import {
  addPortion,
  emptyWeekPlan,
  removePortion,
  resolvePlan,
  setDayIncluded,
  setPortionFood,
  setPortionGrams,
  type WeekPlan,
  weekDays,
} from "./plan";

const milk = {
  id: "milk",
  food: "Latte parzialmente scremato UHT",
  grams: 150,
};
const rusks = { id: "rusks", food: "Fette biscottate", grams: 32 };
const walnuts = { id: "walnuts", food: "Noci", grams: 15 };

function breakfastPlan(): WeekPlan {
  let plan = emptyWeekPlan();
  for (const portion of [milk, rusks, walnuts])
    plan = addPortion(plan, 0, 0, portion);
  return plan;
}

describe("week plan", () => {
  it("starts with 7 included days of 6 empty meals", () => {
    const plan = emptyWeekPlan();
    expect(plan.days).toHaveLength(weekDays.length);
    for (const day of plan.days) {
      expect(day.included).toBe(true);
      expect(day.meals).toEqual(mealSlots.map(() => []));
    }
  });

  it("adds a portion only to the given day and meal, in order", () => {
    const plan = addPortion(breakfastPlan(), 2, 4, { ...milk, id: "x" });
    expect(plan.days[0]?.meals[0]).toEqual([milk, rusks, walnuts]);
    expect(plan.days[2]?.meals[4]).toEqual([{ ...milk, id: "x" }]);
    const nonEmpty = plan.days.flatMap((day, dayIndex) =>
      day.meals.flatMap((meal, mealIndex) =>
        meal.length > 0 ? [[dayIndex, mealIndex]] : [],
      ),
    );
    expect(nonEmpty).toEqual([
      [0, 0],
      [2, 4],
    ]);
  });

  it("removes only the row with the given id, even with the same food twice", () => {
    const plan = addPortion(breakfastPlan(), 0, 0, { ...milk, id: "milk2" });
    expect(removePortion(plan, 0, 0, "milk").days[0]?.meals[0]).toEqual([
      rusks,
      walnuts,
      { ...milk, id: "milk2" },
    ]);
    const sameIdElsewhere = addPortion(plan, 1, 0, milk);
    const removed = removePortion(sameIdElsewhere, 1, 0, "milk");
    expect(removed.days[1]?.meals[0]).toEqual([]);
    expect(removed.days[0]?.meals[0]).toHaveLength(4);
  });

  it("updates grams of one row without touching others", () => {
    const base = addPortion(breakfastPlan(), 1, 0, rusks);
    const plan = setPortionGrams(base, 0, 0, "rusks", 40);
    expect(plan.days[0]?.meals[0]).toEqual([
      milk,
      { ...rusks, grams: 40 },
      walnuts,
    ]);
    expect(plan.days[1]?.meals[0]).toEqual([rusks]);
    expect(base.days[0]?.meals[0]?.[1]?.grams).toBe(32);
  });

  it("toggles inclusion of one day only", () => {
    const plan = setDayIncluded(emptyWeekPlan(), 3, false);
    expect(plan.days.map((day) => day.included)).toEqual([
      true,
      true,
      true,
      false,
      true,
      true,
      true,
    ]);
    expect(setDayIncluded(plan, 3, true).days[3]?.included).toBe(true);
  });

  it("rejects days and meals out of range", () => {
    expect(() => addPortion(emptyWeekPlan(), 7, 0, milk)).toThrow(RangeError);
    expect(() => addPortion(emptyWeekPlan(), 0, 6, milk)).toThrow(RangeError);
  });

  it("resolves a day into the workbook breakfast totals", () => {
    const total = resolvePlan(breakfastPlan(), lookupFood).days[0]?.total;
    if (!total) throw new Error("Missing Monday total");
    expect(total.caloriesKcal).toBeCloseTo(290.94);
    expect(total.carbohydratesG).toBeCloseTo(33.7065);
    expect(total.fatG).toBeCloseTo(14.1015);
    expect(total.proteinG).toBeCloseTo(10.7005);
  });

  it("keeps unknown rows intact and marks only affected calculations incomplete", () => {
    const first = { id: "unknown-a", food: "Zorbaluna inventata", grams: 37 };
    const second = { id: "unknown-b", food: "Quarzopane inventato", grams: 91 };
    let plan = addPortion(breakfastPlan(), 0, 0, first);
    plan = addPortion(plan, 2, 3, second);
    const saved = JSON.stringify(plan);
    const result = resolvePlan(plan, lookupFood);
    expect(result.issues).toEqual([
      { dayIndex: 0, mealIndex: 0, portionId: first.id, food: first.food },
      { dayIndex: 2, mealIndex: 3, portionId: second.id, food: second.food },
    ]);
    expect(result.days[0]?.meals[0]?.total).toBeNull();
    expect(result.days[0]?.total).toBeNull();
    expect(result.days[0]?.meals[1]?.total?.caloriesKcal).toBe(0);
    expect(result.days[1]?.total?.caloriesKcal).toBe(0);
    expect(result.averageIncomplete).toBe(true);
    expect(result.average).toBeNull();
    expect(JSON.stringify(plan)).toBe(saved);
    expect(JSON.parse(saved)).toEqual(plan);
    plan = setDayIncluded(setDayIncluded(plan, 0, false), 2, false);
    const excluded = resolvePlan(plan, lookupFood);
    expect(excluded.averageIncomplete).toBe(false);
    expect(excluded.average?.caloriesKcal).toBe(0);
  });

  it("repairs exact row ids without changing quantities or the other rows", () => {
    const unknown = { id: "unknown", food: "Zorbaluna inventata", grams: 37 };
    const plan = addPortion(breakfastPlan(), 0, 0, unknown);
    const repaired = setPortionFood(plan, 0, 0, unknown.id, findFood("Noci"));
    expect(repaired.days[0]?.meals[0]).toEqual([
      milk,
      rusks,
      walnuts,
      { ...unknown, food: "Noci" },
    ]);
    expect(repaired.days[0]?.meals[0]?.[2]).toBe(walnuts);
    expect(repaired.days[1]).toBe(plan.days[1]);
    expect(resolvePlan(repaired, lookupFood).issues).toEqual([]);
    expect(resolvePlan(repaired, lookupFood).days[0]?.total).not.toBeNull();
    const removed = removePortion(plan, 0, 0, unknown.id);
    expect(removed.days[0]?.meals[0]).toEqual([milk, rusks, walnuts]);
    expect(removed.days[0]?.meals[0]?.[2]).toBe(walnuts);
    expect(resolvePlan(removed, lookupFood).issues).toEqual([]);
    expect(
      resolvePlan(removed, lookupFood).days[0]?.total?.caloriesKcal,
    ).toBeCloseTo(290.94);
    expect(plan.days[0]?.meals[0]?.[3]).toBe(unknown);
  });
});

describe("food search", () => {
  it("matches every word, ignoring case and accents, prefixes first", () => {
    const names = searchFoods("fette").map((food) => food.name);
    expect(names[0]).toBe("Fette biscottate");
    expect(searchFoods("LATTE uht").map((food) => food.name)).toContain(
      "Latte parzialmente scremato UHT",
    );
    expect(searchFoods("")).toHaveLength(195);
    expect(searchFoods("zzzz")).toEqual([]);
  });

  it("throws on unknown food names", () => {
    expect(() => findFood("Nessuno")).toThrow();
  });
});

describe("formatting", () => {
  it("uses comma decimals with at most one decimal", () => {
    expect(formatNumber(290.94)).toBe("290,9");
    expect(formatNumber(14)).toBe("14");
    expect(formatNutrient(0, null)).toBe("–");
    expect(formatNutrient(0, 0)).toBe("0");
  });

  it("parses grams with comma or dot", () => {
    expect(parseGrams("32,5")).toBe(32.5);
    expect(parseGrams(" 150 ")).toBe(150);
    expect(parseGrams("")).toBeNull();
    expect(parseGrams("-3")).toBeNull();
    expect(parseGrams("abc")).toBeNull();
  });
});
