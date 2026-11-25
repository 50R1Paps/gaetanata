import { useEffect, useRef } from "react";
import type { Draft } from "../draftApi";
import type { Patient } from "../patient";
import { ErrorMessage } from "./ErrorMessage";

export function RestoreDraftPrompt({
  draft,
  patient,
  busy,
  error,
  onRestore,
  onDiscard,
  onRetry,
}: {
  draft: Draft | null | undefined;
  patient: Patient | null;
  busy: boolean;
  error: string | null;
  onRestore(): Promise<void>;
  onDiscard(): Promise<void>;
  onRetry(): Promise<void>;
}) {
  const prompt = useRef<HTMLElement>(null);
  useEffect(() => {
    prompt.current?.focus();
  }, []);
  const date = draft ? new Date(draft.updatedAt) : null;
  const documents = [draft?.plan && "piano", draft?.schema && "schema"]
    .filter(Boolean)
    .join(" e ");
  return (
    <section
      ref={prompt}
      tabIndex={-1}
      className="confirm-delete"
      aria-label="Bozza da recuperare"
    >
      {draft && date ? (
        <>
          <p>
            Modifiche non salvate a {documents}{" "}
            {patient ? `di ${patient.name}` : "senza paziente"}, del{" "}
            {date.toLocaleDateString("it-IT")} alle{" "}
            {date.toLocaleTimeString("it-IT", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            .
          </p>
          <button type="button" disabled={busy} onClick={onRestore}>
            Ripristina
          </button>
          <button type="button" disabled={busy} onClick={onDiscard}>
            Scarta
          </button>
        </>
      ) : (
        <>
          <p>Ricerca della bozza…</p>
          {error && (
            <button type="button" disabled={busy} onClick={onRetry}>
              Riprova
            </button>
          )}
        </>
      )}
      {error && <ErrorMessage message={error} />}
    </section>
  );
}
