import { useId, useState } from "react";
import { type WeekPlan, weekDays } from "../plan";
import { type SchemaProteinSource, schemaDays } from "../schema";
import type { SchemaCalculation } from "../schemaCalc";
import {
  isWeekPlanNonEmpty,
  type SkippedPortion,
  schemaToWeekPlan,
} from "../schemaToPlan";

const mealNames = { lunch: "pranzo", dinner: "cena" } as const;

/** «Riempi il piano settimanale»: replaces the free editor's plan with
 * representative foods for every Schema entry, asking first when the plan
 * already has foods. The new plan is unsaved, like any other edit. */
export function SchemaPlanFill({
  result,
  plan,
  setPlan,
  proteinNames,
}: {
  result: SchemaCalculation;
  plan: WeekPlan;
  setPlan: (plan: WeekPlan) => void;
  proteinNames: Record<SchemaProteinSource, string>;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const reasonId = `${baseId}-reason`;
  const skippedId = `${baseId}-skipped`;
  const [confirming, setConfirming] = useState(false);
  const [skipped, setSkipped] = useState<SkippedPortion[] | null>(null);

  function replace() {
    if (!result.ok) return;
    const converted = schemaToWeekPlan(result);
    setPlan(converted.plan);
    setSkipped(converted.skipped);
    setConfirming(false);
  }

  return (
    <section className="panel schema-fill" aria-labelledby={titleId}>
      <h2 id={titleId}>Piano settimanale</h2>
      <div className="schema-word-row">
        <button
          type="button"
          className="patient-button"
          disabled={!result.ok || confirming}
          aria-describedby={result.ok ? undefined : reasonId}
          onClick={() => {
            setSkipped(null);
            if (isWeekPlanNonEmpty(plan)) setConfirming(true);
            else replace();
          }}
        >
          Riempi il piano settimanale
        </button>
        {!result.ok && (
          <p id={reasonId} className="hint">
            Completa lo schema per riempire il piano.
          </p>
        )}
      </div>
      {confirming && (
        <div className="confirm-delete">
          <p>
            Il piano settimanale contiene già alimenti: sostituirlo con quello
            calcolato dallo schema?
          </p>
          <button type="button" className="patient-button" onClick={replace}>
            Sostituisci il piano
          </button>
          <button
            type="button"
            className="patient-button"
            onClick={() => setConfirming(false)}
          >
            Annulla
          </button>
        </div>
      )}
      {skipped && (
        <p role="status">
          Piano riempito con alimenti rappresentativi, non ancora salvato:
          controlla i totali nella vista «Piano settimanale».
        </p>
      )}
      {skipped && skipped.length > 0 && (
        <div className="schema-problem">
          <p id={skippedId}>Pasti non riempiti</p>
          <ul aria-labelledby={skippedId}>
            {skipped.map((entry) => (
              <li key={`${entry.day}-${entry.meal}`}>
                {weekDays[schemaDays.indexOf(entry.day)]}{" "}
                {mealNames[entry.meal]}, {proteinNames[entry.source]}:{" "}
                {entry.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
