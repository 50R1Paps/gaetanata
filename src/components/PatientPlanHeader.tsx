import { Fragment, useEffect, useId, useRef, useState } from "react";
import type { Patient } from "../patient";
import { PatientsDialog } from "./PatientsDialog";

/** Answer to the prompt shown when switching patient with unsaved changes. */
type SwitchChoice = "saved" | "discarded" | "cancelled";

/** Something saved per patient (the plan, the Schema), edited by the caller.
 * Methods, so documents of different types share one list. */
export type PatientDocument<T = unknown> = {
  /** Lower case: "piano", "schema". */
  noun: string;
  /** Noun with its article: "il piano", "lo schema". */
  object: string;
  /** Accessible name of its status. */
  label: string;
  value: T;
  setValue(value: T): void;
  empty(): T;
  load(patientId: number): Promise<T>;
  save(patientId: number, value: T): Promise<unknown>;
  /** Why the current value cannot be saved; null when it can. */
  invalid?: string | null;
  /** Told the value last loaded or saved, which unsaved changes differ
   * from; called in the same update that changes the header's status. */
  setBaseline?(value: T): void;
};

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** Patient changes commit only after every document loads; failed reads keep
 * the old patient and documents. `documents` keeps the same order and length. */
export function PatientPlanHeader({
  patient,
  setPatient,
  documents,
  onBusyChange,
}: {
  patient: Patient | null;
  setPatient: (patient: Patient | null) => void;
  documents: readonly PatientDocument[];
  onBusyChange?: (busy: boolean) => void;
}) {
  const [baselines, setBaselines] = useState(() =>
    documents.map((document) => document.value),
  );
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState(() =>
    documents.map(
      (document) => `Seleziona un paziente per salvare ${document.object}.`,
    ),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const decision = useRef<((choice: SwitchChoice) => void) | null>(null);
  const dirty = documents.map(
    (document, index) => document.value !== baselines[index],
  );
  const anyDirty = dirty.some(Boolean);
  const baseId = useId();
  const saveId = (index: number) => `${baseId}-save-${index}`;
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
    if (!anyDirty) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [anyDirty]);

  function setNotice(index: number, notice: string) {
    setNotices((current) =>
      current.map((old, other) => (other === index ? notice : old)),
    );
  }

  /** Saves the given documents in order, stopping at the first failure.
   * Focus returns to `button` afterwards, except when a successful save
   * lets a pending patient switch go ahead. */
  async function save(indexes: readonly number[], button: string) {
    if (!patient || busy) return false;
    setBusy(true);
    setError(null);
    try {
      for (const index of indexes) {
        const document = documents[index];
        if (!document) continue;
        const Noun = capitalize(document.noun);
        setNotice(index, `Salvataggio ${document.noun} in corso…`);
        try {
          if (document.invalid) throw new Error(document.invalid);
          await document.save(patient.id, document.value);
        } catch (failure) {
          setNotice(index, `${Noun} non salvato.`);
          setError(
            `Salvataggio ${document.noun} non riuscito: ${failure instanceof Error ? failure.message : String(failure)}`,
          );
          focusNext.current = button;
          return false;
        }
        const saved = document.value;
        setBaselines((current) =>
          current.map((old, other) => (other === index ? saved : old)),
        );
        document.setBaseline?.(saved);
        setNotice(index, `${Noun} salvato.`);
      }
      if (!pending) focusNext.current = button;
      return true;
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
    const wasDirty = dirty;
    if (anyDirty) {
      const { promise, resolve } = Promise.withResolvers<SwitchChoice>();
      decision.current = resolve;
      setPending(true);
      focusNext.current = cancelSwitchId;
      choice = await promise;
      if (choice === "cancelled") return false;
    }
    setBusy(true);
    setError(null);
    setNotices(
      documents.map((document) => `Caricamento ${document.noun} in corso…`),
    );
    let loading = documents[0];
    try {
      const loaded: unknown[] = [];
      for (loading of documents)
        loaded.push(next ? await loading.load(next.id) : loading.empty());
      documents.forEach((document, index) => {
        document.setValue(loaded[index]);
        document.setBaseline?.(loaded[index]);
      });
      setBaselines(loaded);
      setPatient(next);
      setNotices(
        documents.map((document, index) => {
          const Noun = capitalize(document.noun);
          return `${choice === "saved" && wasDirty[index] ? `${Noun} precedente salvato. ` : ""}${
            next
              ? `${Noun} caricato.`
              : `Seleziona un paziente per salvare ${document.object}.`
          }`;
        }),
      );
      return true;
    } catch (failure) {
      setNotices(
        documents.map(
          (document) => `${capitalize(document.noun)} precedente mantenuto.`,
        ),
      );
      setError(
        `Caricamento ${loading?.noun} non riuscito: ${failure instanceof Error ? failure.message : String(failure)}. Seleziona di nuovo la scheda per riprovare.`,
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
    const empty = documents.map((document) => document.empty());
    setPatient(null);
    documents.forEach((document, index) => {
      document.setValue(empty[index]);
      document.setBaseline?.(empty[index]);
    });
    setBaselines(empty);
    setError(null);
    setNotices(
      documents.map((document) => `Scheda e ${document.noun} eliminati.`),
    );
  }

  const dirtyIndexes = documents.flatMap((_, index) =>
    dirty[index] ? [index] : [],
  );
  const changed = dirtyIndexes
    .map((index) => documents[index]?.object)
    .join(" e ");
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
            aria-label="Modifiche non salvate"
          >
            <p>
              {capitalize(changed)}{" "}
              {dirtyIndexes.length > 1 ? "contengono" : "contiene"} modifiche
              non salvate. Salvarle o scartarle prima di cambiare paziente?
            </p>
            <button
              type="button"
              id={saveSwitchId}
              disabled={!patient || busy}
              onClick={async () => {
                if (await save(dirtyIndexes, saveSwitchId)) decide("saved");
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
      {documents.map((document, index) => (
        <Fragment key={document.noun}>
          <button
            type="button"
            id={saveId(index)}
            className="patient-button"
            disabled={!patient || busy || pending}
            onClick={() => save([index], saveId(index))}
          >
            Salva {document.noun}
          </button>
          <span role="status" aria-label={document.label}>
            {busy
              ? notices[index]
              : dirty[index]
                ? `${capitalize(document.noun)} modificato, non salvato.`
                : notices[index]}
          </span>
        </Fragment>
      ))}
      {error && !pending && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </>
  );
}
