import { useRef } from "react";
import type { Patient } from "../patient";
import { PatientManager } from "./PatientManager";

/** Header button with the active patient; opens the patient list and record.
 * The content stays mounted while closed, so unsaved edits are kept. */
export function PatientsDialog({
  patient,
  onSelect,
}: {
  patient: Patient | null;
  onSelect: (patient: Patient | null) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="patient-button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Paziente: <strong>{patient?.name ?? "nessuno"}</strong>
      </button>
      <dialog
        ref={dialogRef}
        className="patients-dialog"
        aria-labelledby="patients-dialog-title"
      >
        <header>
          <h2 id="patients-dialog-title">Schede pazienti</h2>
          <button type="button" onClick={() => dialogRef.current?.close()}>
            Chiudi
          </button>
        </header>
        <PatientManager selectedId={patient?.id ?? null} onSelect={onSelect} />
      </dialog>
    </>
  );
}
