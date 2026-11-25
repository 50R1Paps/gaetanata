import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import {
  DocumentApiError,
  downloadPatientDocument,
  type GeneratedDocument,
  generatePatientDocument,
  listPatientDocuments,
  loadTemplateStatus,
  uploadTemplate,
} from "../documentsApi";
import type { SchemaIssue } from "../schemaCalc";
import { ErrorMessage } from "./ErrorMessage";

const dateTimeFormat = new Intl.DateTimeFormat("it-IT", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const messageOf = (failure: unknown) =>
  failure instanceof Error ? failure.message : String(failure);

/** Hands a file to the browser's download, under the server's name. */
function saveFile({ blob, filename }: { blob: Blob; filename: string }) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoked later: some browsers read the URL after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The Word of the Schema: the shared template (uploaded once, replaceable),
 * generation from the saved Schema, and the patient's generated history.
 * Mounted per patient, so nothing carries over to another patient. */
export function SchemaWordPanel({
  patientId,
  schemaDirty,
}: {
  patientId: number;
  schemaDirty: boolean;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const reasonId = `${baseId}-reason`;
  const historyId = `${baseId}-history`;
  const fileInput = useRef<HTMLInputElement>(null);
  const [template, setTemplate] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState<{
    message: string;
    issues: SchemaIssue[];
  } | null>(null);
  const [history, setHistory] = useState<GeneratedDocument[] | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    loadTemplateStatus().then(
      (status) => current && setTemplate(status.available),
      (failure) =>
        current &&
        setTemplateError(
          `Stato del template non verificato: ${messageOf(failure)}`,
        ),
    );
    listPatientDocuments(patientId).then(
      (documents) => current && setHistory(documents),
      (failure) =>
        current &&
        setHistoryError(`Storico non caricato: ${messageOf(failure)}`),
    );
    return () => {
      current = false;
    };
  }, [patientId]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    // Cleared so that choosing the same file again uploads it again.
    input.value = "";
    if (!file) return;
    setUploading(true);
    setTemplateError(null);
    try {
      setTemplate((await uploadTemplate(file)).available);
      setProblem(null);
    } catch (failure) {
      setTemplateError(messageOf(failure));
    } finally {
      setUploading(false);
    }
  }

  async function generate() {
    setGenerating(true);
    setNotice("");
    setProblem(null);
    try {
      const document = await generatePatientDocument(patientId);
      saveFile(document);
      setNotice(`Word generato: ${document.filename}.`);
    } catch (failure) {
      setProblem({
        message: messageOf(failure),
        issues: failure instanceof DocumentApiError ? failure.issues : [],
      });
      return;
    } finally {
      setGenerating(false);
    }
    try {
      setHistory(await listPatientDocuments(patientId));
      setHistoryError(null);
    } catch (failure) {
      setHistoryError(`Storico non aggiornato: ${messageOf(failure)}`);
    }
  }

  async function download(entry: GeneratedDocument) {
    setHistoryError(null);
    try {
      saveFile(await downloadPatientDocument(patientId, entry.id));
    } catch (failure) {
      setHistoryError(`Download del Word non riuscito: ${messageOf(failure)}`);
    }
  }

  const reasons = [
    template === null && !templateError && "Verifica del template in corso…",
    template === null && templateError && "Template Word non verificato.",
    template === false && "Carica il template Word per generare il documento.",
    schemaDirty &&
      "Salva lo schema prima di generare: il Word usa lo schema salvato.",
  ].filter(Boolean);
  const reason = reasons.length > 0 ? reasons.join(" ") : null;

  return (
    <section className="panel schema-word" aria-labelledby={titleId}>
      <h2 id={titleId}>Documento Word</h2>
      <div className="schema-word-row">
        <p role="status">
          {uploading
            ? "Caricamento del template in corso…"
            : template === null
              ? templateError
                ? "Template Word non verificato."
                : "Verifica del template in corso…"
              : template
                ? "Template Word caricato."
                : "Template Word non caricato."}
        </p>
        <button
          type="button"
          className="patient-button"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          {template ? "Sostituisci template…" : "Carica template…"}
        </button>
        <input
          ref={fileInput}
          type="file"
          hidden
          aria-label="File del template Word"
          accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={upload}
        />
      </div>
      {templateError && (
        <ErrorMessage
          className="schema-problem schema-word-error"
          message={templateError}
        />
      )}

      <div className="schema-word-row">
        <button
          type="button"
          className="patient-button primary"
          disabled={generating || reason !== null}
          aria-describedby={reason ? reasonId : undefined}
          onClick={generate}
        >
          Genera Word
        </button>
        {reason && (
          <p id={reasonId} className="hint">
            {reason}
          </p>
        )}
      </div>
      <p role="status">{generating ? "Generazione in corso…" : notice}</p>
      {problem && (
        <ErrorMessage
          as="div"
          className="schema-problem schema-word-error"
          message={
            problem.issues.length > 0
              ? "Completa i dati prima di generare il Word:"
              : problem.message
          }
          reportable={problem.issues.length === 0}
        >
          {problem.issues.length > 0 && (
            <ul>
              {problem.issues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          )}
        </ErrorMessage>
      )}

      <h3 id={historyId}>Storico</h3>
      {history === null ? (
        !historyError && <p className="muted">Caricamento dello storico…</p>
      ) : history.length === 0 ? (
        <p className="muted">Nessun documento generato.</p>
      ) : (
        <ul className="schema-history" aria-labelledby={historyId}>
          {history.map((entry) => (
            <li key={entry.id}>
              <time dateTime={entry.date}>
                {dateTimeFormat.format(new Date(entry.date))}
              </time>
              <span className="schema-history-name">{entry.filename}</span>
              <button
                type="button"
                className="patient-button"
                aria-label={`Scarica ${entry.filename}`}
                onClick={() => download(entry)}
              >
                Scarica
              </button>
            </li>
          ))}
        </ul>
      )}
      {historyError && (
        <ErrorMessage className="schema-problem" message={historyError} />
      )}
    </section>
  );
}
