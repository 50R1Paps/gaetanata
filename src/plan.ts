import {
  type Day,
  dayTotal,
  type Food,
  type Meal,
  mealSlots,
  type Nutrients,
  weeklyAverage,
} from "./calc";

export const weekDays = [
  "Lunedì",
  "Martedì",
  "Mercoledì",
  "Giovedì",
  "Venerdì",
  "Sabato",
  "Domenica",
] as const;

/** One food in a meal. `food` is the name in the food table; `id` only keeps
 * rows distinct (the same food can appear twice in a meal). */
export type PlannedPortion = { id: string; food: string; grams: number };
/** `meals` has one entry per `mealSlots` item, in the same order. */
export type PlannedDay = {
  included: boolean;
  meals: readonly (readonly PlannedPortion[])[];
};
/** Serializable weekly diet: `days` has one entry per `weekDays` item.
 * `included` marks the days counted in the weekly average. */
export type WeekPlan = { days: readonly PlannedDay[] };

export function emptyWeekPlan(): WeekPlan {
  return {
    days: weekDays.map(() => ({
      included: true,
      meals: mealSlots.map(() => []),
    })),
  };
}

function checkIndex(index: number, length: number, what: string) {
  if (!Number.isInteger(index) || index < 0 || index >= length)
    throw new RangeError(`${what} ${index} non valido`);
}

function updateDay(
  plan: WeekPlan,
  dayIndex: number,
  update: (day: PlannedDay) => PlannedDay,
): WeekPlan {
  checkIndex(dayIndex, plan.days.length, "Giorno");
  return {
    ...plan,
    days: plan.days.map((day, index) =>
      index === dayIndex ? update(day) : day,
    ),
  };
}

function updateMeal(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  update: (meal: readonly PlannedPortion[]) => readonly PlannedPortion[],
): WeekPlan {
  return updateDay(plan, dayIndex, (day) => {
    checkIndex(mealIndex, day.meals.length, "Pasto");
    return {
      ...day,
      meals: day.meals.map((meal, index) =>
        index === mealIndex ? update(meal) : meal,
      ),
    };
  });
}

export function addPortion(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  portion: PlannedPortion,
): WeekPlan {
  return updateMeal(plan, dayIndex, mealIndex, (meal) => [...meal, portion]);
}

export function removePortion(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  portionId: string,
): WeekPlan {
  return updateMeal(plan, dayIndex, mealIndex, (meal) =>
    meal.filter((portion) => portion.id !== portionId),
  );
}

export function setPortionGrams(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  portionId: string,
  grams: number,
): WeekPlan {
  return updateMeal(plan, dayIndex, mealIndex, (meal) =>
    meal.map((portion) =>
      portion.id === portionId ? { ...portion, grams } : portion,
    ),
  );
}

export function setDayIncluded(
  plan: WeekPlan,
  dayIndex: number,
  included: boolean,
): WeekPlan {
  return updateDay(plan, dayIndex, (day) => ({ ...day, included }));
}

/** Resolves food names into the shape used by `src/calc`. */
export function toCalcDay(
  day: PlannedDay,
  findFood: (name: string) => Food,
): Day {
  const meal = (index: number): Meal =>
    (day.meals[index] ?? []).map((portion) => ({
      food: findFood(portion.food),
      grams: portion.grams,
    }));
  return [meal(0), meal(1), meal(2), meal(3), meal(4), meal(5)];
}

/** A day is empty when none of its meals has a portion; zero calories do not
 * make a day empty. */
export function isDayEmpty(day: PlannedDay): boolean {
  return day.meals.every((meal) => meal.length === 0);
}

/** Per day: whether it enters the weekly average, i.e. it has at least one
 * portion and was not excluded manually. */
export function countedDays(plan: WeekPlan): boolean[] {
  return plan.days.map((day) => day.included && !isDayEmpty(day));
}

/** Weekly average over counted days; `null` when no day is counted. */
export function weekAverage(
  plan: WeekPlan,
  findFood: (name: string) => Food,
): Nutrients | null {
  const counted = countedDays(plan);
  return weeklyAverage(
    plan.days.map((day, index) => ({
      total: dayTotal(toCalcDay(day, findFood)),
      included: counted[index] ?? false,
    })),
  );
}
