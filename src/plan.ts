import {
  type Food,
  mealSlots,
  mealTotal,
  type Nutrients,
  type Portion,
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

/** Replacement keeps row identity and quantity, including for unknown names. */
export function setPortionFood(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  portionId: string,
  food: Food,
): WeekPlan {
  return updateMeal(plan, dayIndex, mealIndex, (meal) =>
    meal.map((portion) =>
      portion.id === portionId ? { ...portion, food: food.name } : portion,
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

export type UnresolvedFood = {
  dayIndex: number;
  mealIndex: number;
  portionId: string;
  food: string;
};

export type ResolvedMeal = {
  /** Same positions as stored rows; undefined means an unresolved food. */
  portions: readonly (Portion | undefined)[];
  total: Nutrients | null;
};

/** Derived validation only: never write resolved data back into the saved plan.
 * Exporters must reject a plan while `issues` is nonempty. */
export function resolvePlan(
  plan: WeekPlan,
  lookup: (name: string) => Food | undefined,
) {
  const issues: UnresolvedFood[] = [];
  const days = plan.days.map((day, dayIndex) => {
    const known: Portion[] = [];
    const meals = day.meals.map((meal, mealIndex): ResolvedMeal => {
      let complete = true;
      const resolved: Portion[] = [];
      const portions = meal.map((portion) => {
        const food = lookup(portion.food);
        if (!food) {
          complete = false;
          issues.push({
            dayIndex,
            mealIndex,
            portionId: portion.id,
            food: portion.food,
          });
          return undefined;
        }
        const result = { food, grams: portion.grams };
        resolved.push(result);
        known.push(result);
        return result;
      });
      return { portions, total: complete ? mealTotal(resolved) : null };
    });
    return {
      meals,
      total: meals.every((meal) => meal.total !== null)
        ? mealTotal(known)
        : null,
    };
  });
  const averageIncomplete = days.some(
    (day, index) => plan.days[index]?.included && day.total === null,
  );
  const average = averageIncomplete
    ? null
    : weeklyAverage(
        days.flatMap((day, index) =>
          day.total
            ? [
                {
                  total: day.total,
                  included: plan.days[index]?.included ?? false,
                },
              ]
            : [],
        ),
      );
  return { days, issues, average, averageIncomplete };
}
