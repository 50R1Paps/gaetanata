import {
  type KeyboardEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { type Food, mealSlots } from "./calc";
import { FoodSearch } from "./components/FoodSearch";
import { MealCard } from "./components/MealCard";
import {
  type PatientDocument,
  PatientPlanHeader,
} from "./components/PatientPlanHeader";
import { SchemaScreen } from "./components/SchemaScreen";
import { SummaryPanel } from "./components/SummaryPanel";
import { writeDraft } from "./draftApi";
import { defaultGrams, lookupFood } from "./foods";
import { formatNumber } from "./format";
import { localToday, type Patient } from "./patient";
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
import { loadPlan, savePlan } from "./plansApi";
import { type DietSchema, emptySchema, isDietSchema } from "./schema";
import { loadSchema, saveSchema } from "./schemasApi";
import "./App.css";

export function App({ initialPlan }: { initialPlan?: WeekPlan } = {}) {
  const [plan, setPlan] = useState(() => initialPlan ?? emptyWeekPlan());
  const [schema, setSchema] = useState(emptySchema);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [view, setView] = useState<"plan" | "schema">("plan");
  const [dayIndex, setDayIndex] = useState(0);
  const [mealIndex, setMealIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [patientBusy, setPatientBusy] = useState(false);
  // Same comparison as the header's: the Word is generated from the saved one.
  const [savedSchema, setSavedSchema] = useState(schema);
  const updateDraft = useCallback(
    (dirty: readonly boolean[]) =>
      writeDraft({
        patientId: patient?.id ?? null,
        ...(dirty[0] ? { plan } : {}),
        ...(dirty[1] ? { schema } : {}),
      }),
    [patient?.id, plan, schema],
  );
  const documents: PatientDocument[] = [
    {
      noun: "piano",
      object: "il piano",
      label: "Piano settimanale",
      value: plan,
      setValue: setPlan,
      empty: emptyWeekPlan,
      load: loadPlan,
      save: savePlan,
    } satisfies PatientDocument<WeekPlan>,
    {
      noun: "schema",
      object: "lo schema",
      label: "Schema",
      value: schema,
      setValue: setSchema,
      empty: emptySchema,
      load: loadSchema,
      save: saveSchema,
      invalid: isDietSchema(schema)
        ? null
        : "controlla le impostazioni segnalate nello schema.",
      setBaseline: setSavedSchema,
    } satisfies PatientDocument<DietSchema>,
  ];

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
    <div className={view === "schema" ? "app schema-view" : "app"}>
      <header className="app-header">
        <h1>Gaetanata</h1>
        <p>Elaborazione dieta settimanale</p>
        <PatientPlanHeader
          patient={patient}
          setPatient={setPatient}
          documents={documents}
          onBusyChange={setPatientBusy}
          onDraftChange={updateDraft}
        />
        <fieldset className="view-switch">
          <legend className="visually-hidden">Vista</legend>
          {(
            [
              ["plan", "Piano settimanale"],
              ["schema", "Schema"],
            ] as const
          ).map(([key, name]) => (
            <label key={key}>
              <input
                type="radio"
                name="view"
                checked={view === key}
                onChange={() => setView(key)}
              />
              {name}
            </label>
          ))}
        </fieldset>
        {resolved.issues.length > 0 && (
          <p role="alert">
            Alimenti non riconosciuti: correggi le righe segnalate. I totali
            coinvolti sono incompleti.
          </p>
        )}
      </header>
      <div style={{ display: "contents" }} inert={patientBusy}>
        {view === "schema" ? (
          <SchemaScreen
            patient={patient}
            schema={schema}
            setSchema={setSchema}
            schemaDirty={schema !== savedSchema}
            plan={plan}
            setPlan={setPlan}
            today={localToday()}
          />
        ) : (
          <>
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
                    meal={
                      calcDay.meals[slotIndex] ?? { portions: [], total: null }
                    }
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
                        setPortionGrams(
                          current,
                          dayIndex,
                          slotIndex,
                          id,
                          grams,
                        ),
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
          </>
        )}
      </div>
    </div>
  );
}
