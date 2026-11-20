import { useMemo, useState } from "react";
import { type Food, mealSlots } from "./calc";
import { FoodSearch } from "./components/FoodSearch";
import { MealCard } from "./components/MealCard";
import { SummaryPanel } from "./components/SummaryPanel";
import { defaultGrams, lookupFood } from "./foods";
import { formatNumber } from "./format";
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
import "./App.css";

export function App({ initialPlan }: { initialPlan?: WeekPlan } = {}) {
  const [plan, setPlan] = useState(() => initialPlan ?? emptyWeekPlan());
  const [dayIndex, setDayIndex] = useState(0);
  const [mealIndex, setMealIndex] = useState(0);

  const resolved = useMemo(() => resolvePlan(plan, lookupFood), [plan]);
  const { days, average, averageIncomplete } = resolved;
  const day = plan.days[dayIndex];
  const calcDay = days[dayIndex];
  if (!day || !calcDay) throw new Error("Giorno non valido");
  const total = calcDay.total;
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
      {resolved.issues.length > 0 && (
        <p role="alert">
          Alimenti non riconosciuti: correggi le righe segnalate. I totali
          coinvolti sono incompleti.
        </p>
      )}
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
                {days[index]?.total
                  ? `${formatNumber(days[index].total.caloriesKcal)} kcal`
                  : "Incompleto"}
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
              meal={calcDay.meals[slotIndex] ?? { portions: [], total: null }}
              active={slotIndex === mealIndex}
              onActivate={() => setMealIndex(slotIndex)}
              onAdd={(food) => add(slotIndex, food)}
              onRemove={(id) =>
                setPlan((current) =>
                  removePortion(current, dayIndex, slotIndex, id),
                )
              }
              onReplace={(id, food) =>
                setPlan((current) =>
                  setPortionFood(current, dayIndex, slotIndex, id, food),
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
          kcal: days[index]?.total?.caloriesKcal ?? null,
          included: plan.days[index]?.included ?? false,
        }))}
        average={average}
        averageIncomplete={averageIncomplete}
        onToggleDay={(index, included) =>
          setPlan((current) => setDayIncluded(current, index, included))
        }
      />
    </div>
  );
}
