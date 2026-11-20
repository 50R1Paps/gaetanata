import { type ReactNode, useRef } from "react";
import type { Patient } from "../patient";
import { PatientManager } from "./PatientManager";

/** Header button with the active patient; opens the patient list and record.
 * The content stays mounted while closed, so unsaved edits are kept. */
export function PatientsDialog({
  patient,
  onSelect,
  onDeleted,
  children,
  closeDisabled = false,
}: {
  patient: Patient | null;
  onSelect: (patient: Patient | null) => void | boolean | Promise<boolean>;
  onDeleted?: () => void;
  children?: ReactNode;
  closeDisabled?: boolean;
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
        onCancel={(event) => {
          if (closeDisabled) event.preventDefault();
        }}
      >
        <header>
          <h2 id="patients-dialog-title">Schede pazienti</h2>
          <button
            type="button"
            disabled={closeDisabled}
            onClick={() => dialogRef.current?.close()}
          >
            Chiudi
          </button>
        </header>
        {children}
        <PatientManager
          selectedId={patient?.id ?? null}
          onSelect={onSelect}
          onDeleted={onDeleted}
        />
      </dialog>
    </>
  );
}
