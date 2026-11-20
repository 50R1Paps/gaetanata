import { useEffect, useId, useRef, useState } from "react";
import type { Patient } from "../patient";
import { emptyWeekPlan, type WeekPlan } from "../plan";
import { loadPlan, savePlan } from "../plansApi";
import { PatientsDialog } from "./PatientsDialog";

/** Answer to the prompt shown when switching patient with unsaved changes. */
type SwitchChoice = "saved" | "discarded" | "cancelled";

/** Patient changes commit only after loading succeeds; failed reads keep the old editor. */
export function PatientPlanHeader({
  plan,
  setPlan,
  onBusyChange,
}: {
  plan: WeekPlan;
  setPlan: (plan: WeekPlan) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [baseline, setBaseline] = useState(plan);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(
    "Seleziona un paziente per salvare il piano.",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const decision = useRef<((choice: SwitchChoice) => void) | null>(null);
  const dirty = plan !== baseline;
  const baseId = useId();
  const savePlanId = `${baseId}-save`;
  const saveSwitchId = `${baseId}-save-switch`;
  const cancelSwitchId = `${baseId}-cancel-switch`;
  // Id of the element to focus once the next render has put it on screen:
  // the safe answer of the switch prompt, or a save button that saving
  // disabled (which drops keyboard focus).
  const focusNext = useRef<string | null>(null);

  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });
  useEffect(() => {
    onBusyChange?.(busy || pending);
  }, [busy, pending, onBusyChange]);
  useEffect(() => {
    if (!dirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /** Focus returns to `button` afterwards, except when a successful save
   * lets a pending patient switch go ahead. */
  async function save(button: string) {
    if (!patient || busy) return false;
    setBusy(true);
    setError(null);
    setNotice("Salvataggio piano in corso…");
    try {
      await savePlan(patient.id, plan);
      setBaseline(plan);
      setNotice("Piano salvato.");
      if (!pending) focusNext.current = button;
      return true;
    } catch (failure) {
      setNotice("Piano non salvato.");
      setError(
        `Salvataggio piano non riuscito: ${failure instanceof Error ? failure.message : String(failure)}`,
      );
      focusNext.current = button;
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function select(next: Patient | null): Promise<boolean> {
    if (busy || pending) return false;
    if (next?.id === patient?.id) {
      setPatient(next);
      return true;
    }
    let choice: SwitchChoice = "discarded";
    if (dirty) {
      const { promise, resolve } = Promise.withResolvers<SwitchChoice>();
      decision.current = resolve;
      setPending(true);
      focusNext.current = cancelSwitchId;
      choice = await promise;
      if (choice === "cancelled") return false;
    }
    setBusy(true);
    setError(null);
    setNotice("Caricamento piano in corso…");
    try {
      const loaded = next ? await loadPlan(next.id) : emptyWeekPlan();
      setPlan(loaded);
      setBaseline(loaded);
      setPatient(next);
      setNotice(
        `${choice === "saved" ? "Piano precedente salvato. " : ""}${
          next
            ? "Piano caricato."
            : "Seleziona un paziente per salvare il piano."
        }`,
      );
      return true;
    } catch (failure) {
      setNotice("Piano precedente mantenuto.");
      setError(
        `Caricamento piano non riuscito: ${failure instanceof Error ? failure.message : String(failure)}. Seleziona di nuovo la scheda per riprovare.`,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }

  function decide(choice: SwitchChoice) {
    setPending(false);
    decision.current?.(choice);
    decision.current = null;
  }

  function deleted() {
    const empty = emptyWeekPlan();
    setPatient(null);
    setPlan(empty);
    setBaseline(empty);
    setError(null);
    setNotice("Scheda e piano eliminati.");
  }

  const status = busy
    ? notice
    : dirty
      ? "Piano modificato, non salvato."
      : notice;
  return (
    <>
      <PatientsDialog
        patient={patient}
        onSelect={select}
        onDeleted={deleted}
        closeDisabled={pending || busy}
      >
        {pending && (
          <section
            className="confirm-delete confirm-switch"
            aria-label="Modifiche al piano"
          >
            <p>
              Il piano contiene modifiche non salvate. Salvarle o scartarle
              prima di cambiare paziente?
            </p>
            <button
              type="button"
              id={saveSwitchId}
              disabled={!patient || busy}
              onClick={async () => {
                if (await save(saveSwitchId)) decide("saved");
              }}
            >
              Salva e cambia
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decide("discarded")}
            >
              Scarta e cambia
            </button>
            <button
              type="button"
              id={cancelSwitchId}
              disabled={busy}
              onClick={() => decide("cancelled")}
            >
              Annulla cambio
            </button>
          </section>
        )}
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </PatientsDialog>
      <button
        type="button"
        id={savePlanId}
        className="patient-button"
        disabled={!patient || busy || pending}
        onClick={() => save(savePlanId)}
      >
        Salva piano
      </button>
      <span role="status" aria-label="Piano settimanale">
        {status}
      </span>
      {error && !pending && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
