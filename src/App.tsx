import { useMemo, useState } from "react";
import { dayTotal, type Food, mealSlots } from "./calc";
import { FoodSearch } from "./components/FoodSearch";
import { MealCard } from "./components/MealCard";
import { SummaryPanel } from "./components/SummaryPanel";
import { defaultGrams, findFood } from "./foods";
import { formatNumber } from "./format";
import {
  addPortion,
  countedDays,
  emptyWeekPlan,
  isDayEmpty,
  removePortion,
  setDayIncluded,
  setPortionGrams,
  toCalcDay,
  weekAverage,
  weekDays,
} from "./plan";
import "./App.css";

export function App() {
  const [plan, setPlan] = useState(emptyWeekPlan);
  const [dayIndex, setDayIndex] = useState(0);
  const [mealIndex, setMealIndex] = useState(0);

  const calcDays = useMemo(
    () => plan.days.map((day) => toCalcDay(day, findFood)),
    [plan],
  );
  const totals = useMemo(() => calcDays.map(dayTotal), [calcDays]);
  const average = useMemo(() => weekAverage(plan, findFood), [plan]);
  const counted = useMemo(() => countedDays(plan), [plan]);

  const day = plan.days[dayIndex];
  const calcDay = calcDays[dayIndex];
  const total = totals[dayIndex];
  if (!day || !calcDay || !total) throw new Error("Giorno non valido");
  const dayName = weekDays[dayIndex] ?? "";

  function add(slotIndex: number, food: Food) {
    const portion = {
      id: crypto.randomUUID(),
      food: food.name,
      grams: defaultGrams(food),
    };
    setPlan((current) => addPortion(current, dayIndex, slotIndex, portion));
    setMealIndex(slotIndex);
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Gaetanata</h1>
        <p>Elaborazione dieta settimanale</p>
      </header>
      <FoodSearch
        targetLabel={`${dayName} · ${mealSlots[mealIndex]}`}
        onAdd={(food) => add(mealIndex, food)}
      />
      <main className="week">
        <div className="day-tabs" role="tablist" aria-label="Giorni">
          {weekDays.map((name, index) => (
            <button
              key={name}
              type="button"
              role="tab"
              id={`tab-${index}`}
              aria-selected={index === dayIndex}
              aria-controls="day-panel"
              onClick={() => setDayIndex(index)}
            >
              <span>{name}</span>
              <span className="tab-kcal">
                {formatNumber(totals[index]?.caloriesKcal ?? 0)} kcal
              </span>
            </button>
          ))}
        </div>
        <div
          className="meals"
          id="day-panel"
          role="tabpanel"
          aria-labelledby={`tab-${dayIndex}`}
        >
          {mealSlots.map((slot, slotIndex) => (
            <MealCard
              key={slot}
              slot={slot}
              slotIndex={slotIndex}
              portions={day.meals[slotIndex] ?? []}
              meal={calcDay[slotIndex] ?? []}
              active={slotIndex === mealIndex}
              onActivate={() => setMealIndex(slotIndex)}
              onAdd={(food) => add(slotIndex, food)}
              onRemove={(id) =>
                setPlan((current) =>
                  removePortion(current, dayIndex, slotIndex, id),
                )
              }
              onGrams={(id, grams) =>
                setPlan((current) =>
                  setPortionGrams(current, dayIndex, slotIndex, id, grams),
                )
              }
            />
          ))}
        </div>
      </main>
      <SummaryPanel
        dayName={dayName}
        dayTotal={total}
        days={weekDays.map((name, index) => ({
          name,
          kcal: totals[index]?.caloriesKcal ?? 0,
          included: plan.days[index]?.included ?? false,
          empty: plan.days[index] ? isDayEmpty(plan.days[index]) : true,
        }))}
        countedCount={counted.filter(Boolean).length}
        average={average}
        onToggleDay={(index, included) =>
          setPlan((current) => setDayIncluded(current, index, included))
        }
      />
    </div>
  );
}
