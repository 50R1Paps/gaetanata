import { useEffect, useRef, useState } from "react";
import type { Patient } from "../patient";
import { emptyWeekPlan, type WeekPlan } from "../plan";
import { loadPlan, savePlan } from "../plansApi";
import { PatientsDialog } from "./PatientsDialog";

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
  const decision = useRef<((accepted: boolean) => void) | null>(null);
  const dirty = plan !== baseline;

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

  async function save() {
    if (!patient || busy) return false;
    setBusy(true);
    setError(null);
    setNotice("Salvataggio piano in corso…");
    try {
      await savePlan(patient.id, plan);
      setBaseline(plan);
      setNotice("Piano salvato.");
      return true;
    } catch (failure) {
      setNotice("Piano non salvato.");
      setError(
        `Salvataggio piano non riuscito: ${failure instanceof Error ? failure.message : String(failure)}`,
      );
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
    if (dirty) {
      const { promise, resolve } = Promise.withResolvers<boolean>();
      decision.current = resolve;
      setPending(true);
      if (!(await promise)) return false;
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
        next
          ? "Piano caricato."
          : "Seleziona un paziente per salvare il piano.",
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

  function decide(accepted: boolean) {
    setPending(false);
    decision.current?.(accepted);
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
          <section className="confirm-delete" aria-label="Modifiche al piano">
            <p>
              Il piano contiene modifiche non salvate. Salvarle o scartarle
              prima di cambiare paziente?
            </p>
            <button
              type="button"
              disabled={!patient || busy}
              onClick={async () => {
                if (await save()) decide(true);
              }}
            >
              Salva e cambia
            </button>
            <button type="button" disabled={busy} onClick={() => decide(true)}>
              Scarta e cambia
            </button>
            <button type="button" disabled={busy} onClick={() => decide(false)}>
              Annulla cambio
            </button>
          </section>
        )}
        {error && <p role="alert">{error}</p>}
      </PatientsDialog>
      <button
        type="button"
        className="patient-button"
        disabled={!patient || busy || pending}
        onClick={save}
      >
        Salva piano
      </button>
      <span role="status" aria-label="Piano settimanale">
        {status}
      </span>
      {error && !pending && <p role="alert">{error}</p>}
    </>
  );
}
