import { type FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  emptyPatientForm,
  type FieldErrors,
  localToday,
  type Patient,
  type PatientField,
  type PatientForm,
  parsePatientForm,
  patientToForm,
} from "../patient";
import {
  ApiError,
  createPatient,
  deletePatient,
  listPatients,
  updatePatient,
} from "../patientsApi";

type ListState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; patients: Patient[] };

const byName = (a: Patient, b: Patient) =>
  a.name.localeCompare(b.name, "it", { sensitivity: "base" }) || a.id - b.id;

/** Patient list plus the record ("scheda") of the selected patient. */
export function PatientManager({
  selectedId,
  onSelect,
  onDeleted,
}: {
  selectedId: number | null;
  onSelect: (patient: Patient | null) => void | boolean | Promise<boolean>;
  onDeleted?: (() => void) | undefined;
}) {
  const [list, setList] = useState<ListState>({ status: "loading" });
  const [reloads, setReloads] = useState(0);
  const [form, setForm] = useState<PatientForm>(emptyPatientForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const birthDateRef = useRef<HTMLInputElement>(null);
  const formId = useId();

  const patients = list.status === "ready" ? list.patients : [];
  const selected = patients.find((patient) => patient.id === selectedId);
  const baseline = selected ? patientToForm(selected) : emptyPatientForm;
  const dirty = (Object.keys(form) as PatientField[]).some(
    (field) => form[field] !== baseline[field],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: reloads triggers a retry
  useEffect(() => {
    let current = true;
    setList({ status: "loading" });
    listPatients().then(
      (loaded) => {
        if (!current) return;
        setList({ status: "ready", patients: loaded });
        const active = loaded.find((patient) => patient.id === selectedId);
        setForm(active ? patientToForm(active) : emptyPatientForm);
      },
      (error: unknown) => {
        if (current) setList({ status: "error", message: messageOf(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [reloads]);

  function show(patient: Patient | null) {
    setForm(patient ? patientToForm(patient) : emptyPatientForm);
    setErrors({});
    setFailure(null);
    setConfirmingDelete(false);
  }

  async function select(patient: Patient | null) {
    if (
      dirty &&
      !window.confirm("Le modifiche non salvate andranno perse. Continuare?")
    )
      return;
    setBusy(true);
    try {
      if ((await onSelect(patient)) === false) return;
      show(patient);
      setNotice(null);
    } finally {
      setBusy(false);
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setNotice(null);
    setFailure(null);
    const parsed = parsePatientForm(form, localToday());
    const found = parsed.ok ? {} : { ...parsed.errors };
    // A half-typed date reaches React as "", so ask the input itself.
    if (birthDateRef.current?.validity.badInput)
      found.birthDate = "Data di nascita non valida.";
    setErrors(found);
    if (!parsed.ok || Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      const saved = selected
        ? await updatePatient(selected.id, parsed.value)
        : await createPatient(parsed.value);
      setList({
        status: "ready",
        patients: [
          ...patients.filter((patient) => patient.id !== saved.id),
          saved,
        ].sort(byName),
      });
      if ((await onSelect(saved)) !== false) show(saved);
      setNotice("Scheda salvata.");
    } catch (error) {
      if (error instanceof ApiError) setErrors(error.fields);
      setFailure(`Salvataggio non riuscito: ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(patient: Patient) {
    setNotice(null);
    setFailure(null);
    setBusy(true);
    try {
      await deletePatient(patient.id);
      setList({
        status: "ready",
        patients: patients.filter((other) => other.id !== patient.id),
      });
      show(null);
      if (onDeleted) onDeleted();
      else await onSelect(null);
      setNotice("Scheda eliminata.");
    } catch (error) {
      setConfirmingDelete(false);
      setFailure(`Eliminazione non riuscita: ${messageOf(error)}`);
    } finally {
      setBusy(false);
    }
  }

  function field(name: Exclude<PatientField, "sex">) {
    return {
      id: `${formId}-${name}`,
      value: form[name],
      "aria-invalid": errors[name] ? true : undefined,
      "aria-describedby": errors[name] ? `${formId}-${name}-error` : undefined,
      onChange: (event: { target: { value: string } }) =>
        setForm({ ...form, [name]: event.target.value }),
    };
  }

  function errorFor(name: PatientField) {
    const message = errors[name];
    return message ? (
      <span className="field-error" id={`${formId}-${name}-error`}>
        {message}
      </span>
    ) : null;
  }

  return (
    <div className="patient-manager">
      <section className="patient-list" aria-label="Pazienti">
        <button
          type="button"
          className="primary"
          onClick={() => select(null)}
          disabled={busy}
        >
          Nuova scheda
        </button>
        {list.status === "loading" && (
          <p className="muted">Caricamento schede…</p>
        )}
        {list.status === "error" && (
          <div role="alert" className="error">
            <p>Impossibile leggere le schede: {list.message}</p>
            <button type="button" onClick={() => setReloads((n) => n + 1)}>
              Riprova
            </button>
          </div>
        )}
        {list.status === "ready" && patients.length === 0 && (
          <p className="muted">Nessuna scheda salvata.</p>
        )}
        {patients.length > 0 && (
          <ul aria-label="Schede pazienti">
            {patients.map((patient) => (
              <li key={patient.id}>
                <button
                  type="button"
                  aria-current={patient.id === selectedId ? "true" : undefined}
                  onClick={() => select(patient)}
                  disabled={busy}
                >
                  {patient.name}
                  {patient.birthDate && (
                    <span className="muted">
                      {" "}
                      · {formatDate(patient.birthDate)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="patient-form" onSubmit={save} noValidate>
        <h3>{selected ? "Modifica scheda" : "Nuova scheda"}</h3>
        <label htmlFor={`${formId}-name`}>Nome (obbligatorio)</label>
        <input type="text" autoComplete="off" {...field("name")} />
        {errorFor("name")}

        <label htmlFor={`${formId}-birthDate`}>Data di nascita</label>
        <input
          type="date"
          max={localToday()}
          ref={birthDateRef}
          {...field("birthDate")}
        />
        {errorFor("birthDate")}

        <label htmlFor={`${formId}-sex`}>Sesso</label>
        <select
          id={`${formId}-sex`}
          value={form.sex}
          aria-invalid={errors.sex ? true : undefined}
          onChange={(event) =>
            setForm({ ...form, sex: event.target.value as PatientForm["sex"] })
          }
        >
          <option value="">Non indicato</option>
          <option value="male">Maschio</option>
          <option value="female">Femmina</option>
        </select>
        {errorFor("sex")}

        <label htmlFor={`${formId}-weightKg`}>Peso (kg)</label>
        <input type="text" inputMode="decimal" {...field("weightKg")} />
        {errorFor("weightKg")}

        <label htmlFor={`${formId}-heightCm`}>Altezza (cm)</label>
        <input type="text" inputMode="decimal" {...field("heightCm")} />
        {errorFor("heightCm")}

        <div className="form-actions">
          <button type="submit" className="primary" disabled={busy}>
            {busy ? "Attendere…" : "Salva scheda"}
          </button>
          {selected && !confirmingDelete && (
            <button
              type="button"
              className="danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
            >
              Elimina scheda
            </button>
          )}
        </div>
        {selected && confirmingDelete && (
          <div className="confirm-delete" role="alert">
            <p>
              Eliminare definitivamente la scheda di{" "}
              <strong>{selected.name}</strong> e il suo piano settimanale?
            </p>
            <button
              type="button"
              className="danger"
              onClick={() => remove(selected)}
              disabled={busy}
            >
              Conferma eliminazione
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Annulla
            </button>
          </div>
        )}
        <div role="status">{notice && <p className="notice">{notice}</p>}</div>
        {failure && (
          <p role="alert" className="error">
            {failure}
          </p>
        )}
      </form>
    </div>
  );
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}
