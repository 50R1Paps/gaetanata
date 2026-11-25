import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { type Draft, loadDraft, writeDraft } from "../draftApi";
import type { Patient } from "../patient";
import { listPatients } from "../patientsApi";
import { ErrorMessage } from "./ErrorMessage";
import { PatientsDialog } from "./PatientsDialog";
import { RestoreDraftPrompt } from "./RestoreDraftPrompt";
import { useWindowId, useWindowSession } from "./WindowGate";

/** Answer to the prompt shown when switching patient with unsaved changes. */
type SwitchChoice = "saved" | "discarded" | "cancelled";

export type DirtyDocuments = { plan: boolean; schema: boolean };

/** Something saved per patient (the plan, the Schema), edited by the caller.
 * Methods, so documents of different types share one list. */
export type PatientDocument<T = unknown> = {
  draftKey: keyof DirtyDocuments;
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
  onDraftChange,
  onDraftPending,
  recoverDraft = false,
}: {
  patient: Patient | null;
  setPatient: (patient: Patient | null) => void;
  documents: readonly PatientDocument[];
  onBusyChange?: (busy: boolean) => void;
  /** Only changed documents belong in the bozza. */
  onDraftChange?: (dirty: DirtyDocuments) => Promise<unknown>;
  onDraftPending?: (dirty: DirtyDocuments) => void;
  recoverDraft?: boolean;
}) {
  const windowId = useWindowId();
  const session = useWindowSession();
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
  const [reportable, setReportable] = useState(true);
  const [pending, setPending] = useState(false);
  const decision = useRef<((choice: SwitchChoice) => void) | null>(null);
  const [recovery, setRecovery] = useState<Draft | null>();
  const [recoveryPatient, setRecoveryPatient] = useState<Patient | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const recoveryBlocked = recoverDraft && recovery !== null;

  const readRecovery = useCallback(async () => {
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const draft = await loadDraft();
      if (session && draft) session.lastWrittenAt = draft.updatedAt;
      const patients = draft?.patientId ? await listPatients() : [];
      const owner =
        patients.find((item) => item.id === draft?.patientId) ?? null;
      if (draft?.patientId && !owner)
        throw new Error("La scheda del paziente non è disponibile.");
      setRecoveryPatient(owner);
      setRecovery(draft);
    } catch (failure) {
      setRecoveryError(
        failure instanceof Error ? failure.message : String(failure),
      );
    } finally {
      setRecoveryBusy(false);
    }
  }, [session]);

  useEffect(() => {
    if (recoverDraft) void readRecovery();
  }, [recoverDraft, readRecovery]);
  const dirty = documents.map(
    (document, index) =>
      JSON.stringify(document.value) !== JSON.stringify(baselines[index]),
  );
  const anyDirty = dirty.some(Boolean);
  const [draftError, setDraftError] = useState<string | null>(null);
  const draftQueue = useRef(Promise.resolve());
  const hadChanges = useRef(false);
  const dirtySignature = JSON.stringify({
    plan: documents.some(
      (document, index) => document.draftKey === "plan" && dirty[index],
    ),
    schema: documents.some(
      (document, index) => document.draftKey === "schema" && dirty[index],
    ),
  });

  useEffect(() => {
    if (!recoveryBlocked)
      onDraftPending?.(JSON.parse(dirtySignature) as DirtyDocuments);
  }, [onDraftPending, dirtySignature, recoveryBlocked]);

  useEffect(() => {
    const write = onDraftChange;
    const changed = JSON.parse(dirtySignature) as DirtyDocuments;
    const hasChanges = changed.plan || changed.schema;
    if (recoveryBlocked) return;
    if (!write || (!hasChanges && !hadChanges.current)) return;
    hadChanges.current = hasChanges;
    const enqueue = () => {
      // Capture this render's values; serialize requests so an older PUT cannot
      // arrive after the DELETE from a successful save or patient switch.
      draftQueue.current = draftQueue.current
        .then(() => write(changed))
        .then(() => setDraftError(null))
        .catch((failure: unknown) => {
          setDraftError(
            `Bozza non scritta: ${failure instanceof Error ? failure.message : String(failure)}`,
          );
        });
    };
    if (!hasChanges) {
      enqueue();
      return;
    }
    const timer = window.setTimeout(enqueue, 1000);
    return () => window.clearTimeout(timer);
  }, [onDraftChange, dirtySignature, recoveryBlocked]);
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
    onBusyChange?.(busy || pending || recoveryBlocked);
  }, [busy, pending, recoveryBlocked, onBusyChange]);

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
          setReportable(!document.invalid);
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

  async function select(
    next: Patient | null,
    restored?: readonly unknown[],
  ): Promise<boolean> {
    if (busy || pending) return false;
    if (!restored && next?.id === patient?.id) {
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
    setReportable(true);
    setNotices(
      documents.map((document) => `Caricamento ${document.noun} in corso…`),
    );
    let loading = documents[0];
    try {
      const loaded: unknown[] = [];
      for (loading of documents)
        loaded.push(next ? await loading.load(next.id) : loading.empty());
      documents.forEach((document, index) => {
        document.setValue(restored?.[index] ?? loaded[index]);
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
      if (restored)
        setRecoveryError(
          `Caricamento ${loading?.noun} non riuscito: ${failure instanceof Error ? failure.message : String(failure)}`,
        );
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
      {recoveryBlocked && (
        <RestoreDraftPrompt
          draft={recovery}
          patient={recoveryPatient}
          busy={recoveryBusy || busy}
          error={recoveryError}
          onRetry={readRecovery}
          onRestore={async () => {
            if (!recovery) return;
            setRecoveryError(null);
            const restored = documents.map(
              (document) => recovery[document.draftKey],
            );
            if (await select(recoveryPatient, restored)) setRecovery(null);
          }}
          onDiscard={async () => {
            setRecoveryBusy(true);
            setRecoveryError(null);
            try {
              await writeDraft(
                { patientId: recovery?.patientId ?? null },
                windowId,
              );
              if (session) delete session.lastWrittenAt;
              setRecovery(null);
            } catch (failure) {
              setRecoveryError(
                failure instanceof Error ? failure.message : String(failure),
              );
            } finally {
              setRecoveryBusy(false);
            }
          }}
        />
      )}
      <div style={{ display: "contents" }} inert={recoveryBlocked}>
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
          {error && <ErrorMessage message={error} reportable={reportable} />}
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
        {draftError && <ErrorMessage message={draftError} />}
        {error && !pending && (
          <ErrorMessage message={error} reportable={reportable} />
        )}
      </div>
    </>
  );
}
