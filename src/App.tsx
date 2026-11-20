import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { type Food, mealSlots } from "./calc";
import { FoodSearch } from "./components/FoodSearch";
import { MealCard } from "./components/MealCard";
import { PatientPlanHeader } from "./components/PatientPlanHeader";
import { SummaryPanel } from "./components/SummaryPanel";
import { defaultGrams, lookupFood } from "./foods";
import { formatNumber } from "./format";
import {
  addPortion,
  countedDays,
  emptyWeekPlan,
  isDayEmpty,
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
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [planBusy, setPlanBusy] = useState(false);

  const resolved = useMemo(() => resolvePlan(plan, lookupFood), [plan]);
  const { days, average, averageIncomplete } = resolved;
  const counted = useMemo(() => countedDays(plan), [plan]);
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

  /** WAI-ARIA horizontal tabs with automatic activation. */
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const last = weekDays.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: dayIndex === last ? 0 : dayIndex + 1,
      ArrowLeft: dayIndex === 0 ? last : dayIndex - 1,
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    setDayIndex(target);
    tabRefs.current[target]?.focus();
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>Gaetanata</h1>
        <p>Elaborazione dieta settimanale</p>
        <PatientPlanHeader
          plan={plan}
          setPlan={setPlan}
          onBusyChange={setPlanBusy}
        />
        {resolved.issues.length > 0 && (
          <p role="alert">
            Alimenti non riconosciuti: correggi le righe segnalate. I totali
            coinvolti sono incompleti.
          </p>
        )}
      </header>
      <div style={{ display: "contents" }} inert={planBusy}>
        <FoodSearch
          targetLabel={`${dayName} · ${mealSlots[mealIndex]}`}
          onAdd={(food) => add(mealIndex, food)}
        />
        <main className="week">
          <div className="day-tabs" role="tablist" aria-label="Giorni">
            {weekDays.map((name, index) => (
              <button
                key={name}
                ref={(element) => {
                  tabRefs.current[index] = element;
                }}
                type="button"
                role="tab"
                id={`tab-${index}`}
                aria-selected={index === dayIndex}
                aria-controls="day-panel"
                tabIndex={index === dayIndex ? 0 : -1}
                onClick={() => setDayIndex(index)}
                onKeyDown={onTabKeyDown}
              >
                <span>{name}</span>
                <span className="tab-kcal">
                  {plan.days[index] && isDayEmpty(plan.days[index])
                    ? "Vuoto"
                    : days[index]?.total
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
            empty: plan.days[index] ? isDayEmpty(plan.days[index]) : true,
          }))}
          countedCount={counted.filter(Boolean).length}
          average={average}
          averageIncomplete={averageIncomplete}
          onToggleDay={(index, included) =>
            setPlan((current) => setDayIncluded(current, index, included))
          }
        />
      </div>
    </div>
  );
}
