import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { DraftInput } from "../draftApi";
import type { UpdateState } from "../update";
import { closeWindow, signalWindow } from "../windowApi";
import { ErrorMessage } from "./ErrorMessage";
import { useReport } from "./Report";

type WindowSession = {
  windowId: string;
  pendingDraft?: DraftInput | null;
  lastWrittenAt?: string;
};
const WindowSessionContext = createContext<WindowSession | null>(null);
const PatientDirtyContext = createContext<((dirty: boolean) => void) | null>(
  null,
);

export function usePatientDirtySetter() {
  return useContext(PatientDirtyContext);
}

function reloadPage() {
  window.location.reload();
}

/** The server-issued ownership uses this random, page-local identity. */
export function useWindowId(): string | null {
  return useContext(WindowSessionContext)?.windowId ?? null;
}

export function useWindowSession() {
  return useContext(WindowSessionContext);
}

export function WindowGate({
  children,
  presenceIntervalMs = 5_000,
  reload = reloadPage,
}: {
  children: ReactNode;
  presenceIntervalMs?: number;
  reload?: () => void;
}) {
  const [windowId] = useState(() => crypto.randomUUID());
  const [session] = useState<WindowSession>(() => ({ windowId }));
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [patientDirty, setPatientDirty] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const progress = useRef<Extract<UpdateState, { status: "progress" }> | null>(
    null,
  );
  const [status, setStatus] = useState<
    "pending" | "active" | "waiting" | "closed"
  >("pending");
  const setReportScreen = useReport()?.setScreen;
  useEffect(() => {
    if (update.status === "progress") setReportScreen?.("update");
    else if (status !== "active") setReportScreen?.(status);
  }, [status, update.status, setReportScreen]);

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    async function presence() {
      try {
        if (progress.current) {
          const response = await fetch("/api/health");
          if (response.ok) {
            const health = await response.json();
            if (
              health.app === "gaetanata" &&
              typeof health.version === "string" &&
              health.version !== progress.current.from
            ) {
              reload();
              return;
            }
          }
        }
        const { active, update: nextUpdate } = await signalWindow(windowId);
        if (disposed) return;
        if (nextUpdate.status === "progress") progress.current = nextUpdate;
        else if (nextUpdate.status === "failed") progress.current = null;
        if (progress.current && nextUpdate.status === "idle") {
          timer = window.setTimeout(() => void presence(), presenceIntervalMs);
          return;
        }
        setUpdate(nextUpdate);
        // A waiting window must not send a former owner's documents.
        if (!active) delete session.pendingDraft;
        setStatus(active ? "active" : "waiting");
        timer = window.setTimeout(() => {
          void presence();
        }, presenceIntervalMs);
      } catch {
        if (!disposed && progress.current)
          timer = window.setTimeout(() => void presence(), presenceIntervalMs);
        else if (!disposed) setStatus("closed");
      }
    }
    function pagehide() {
      disposed = true;
      clearTimeout(timer);
      closeWindow(windowId, session.pendingDraft);
    }
    void presence();
    window.addEventListener("pagehide", pagehide);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [windowId, presenceIntervalMs, session, reload]);

  async function install() {
    setInstalling(true);
    setInstallError(null);
    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ windowId, draft: session.pendingDraft }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Aggiornamento non riuscito");
      progress.current = body.update;
      setUpdate(body.update);
    } catch (error) {
      setInstallError(error instanceof Error ? error.message : String(error));
    } finally {
      setInstalling(false);
    }
  }

  if (update.status === "progress") {
    const labels = {
      scarico: "Scarico",
      installo: "Installo",
      preparo: "Preparo l'interfaccia",
      riavvio: "Riavvio",
    };
    return (
      <section role="status">
        <h2>Aggiornamento in corso</h2>
        {status === "active" && (
          <ol>
            {Object.entries(labels).map(([step, label]) => (
              <li
                key={step}
                aria-current={step === update.step ? "step" : undefined}
              >
                {label}
              </li>
            ))}
          </ol>
        )}
      </section>
    );
  }

  if (status === "waiting")
    return <p role="status">Gaetanata è già aperta in un'altra finestra</p>;
  if (status === "closed") {
    const time =
      session.lastWrittenAt &&
      new Date(session.lastWrittenAt).toLocaleTimeString("it-IT", {
        hour: "2-digit",
        minute: "2-digit",
      });
    return (
      <ErrorMessage
        reportable={false}
        message={`Gaetanata si è chiusa. Riaprila dall'icona${time ? `: le modifiche fino alle ${time} sono nella bozza.` : ". Nessuna bozza scritta in questa finestra."}`}
      />
    );
  }
  if (status === "pending") return <p role="status">Apertura di Gaetanata…</p>;
  return (
    <WindowSessionContext value={session}>
      <PatientDirtyContext value={setPatientDirty}>
        {update.status === "available" && (
          <section
            className="update-banner"
            aria-label="Aggiornamento disponibile"
          >
            <strong>Aggiornamento disponibile: {update.version}</strong>
            <p>{update.notes}</p>
            <button
              type="button"
              disabled={patientDirty || installing}
              onClick={() => void install()}
            >
              Installa aggiornamento
            </button>
            {patientDirty && (
              <p>Salva la scheda paziente prima di aggiornare.</p>
            )}
            {installError && (
              <ErrorMessage
                message={installError}
                failedUpdate={{ attempted: update.version }}
              />
            )}
          </section>
        )}
        {update.status === "failed" && (
          <ErrorMessage
            message={update.message}
            failedUpdate={update.failedUpdate}
          />
        )}
        {update.status === "available" && update.failedMessage && (
          <ErrorMessage
            message={update.failedMessage}
            failedUpdate={update.failedUpdate}
          />
        )}
        <fieldset
          disabled={installing}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          {children}
        </fieldset>
      </PatientDirtyContext>
    </WindowSessionContext>
  );
}
