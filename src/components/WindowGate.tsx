import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import type { DraftInput } from "../draftApi";
import type { UpdateState } from "../update";
import { closeWindow, signalWindow } from "../windowApi";

type WindowSession = {
  windowId: string;
  pendingDraft?: DraftInput | null;
  lastWrittenAt?: string;
};
const WindowSessionContext = createContext<WindowSession | null>(null);

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
}: {
  children: ReactNode;
  presenceIntervalMs?: number;
}) {
  const [windowId] = useState(() => crypto.randomUUID());
  const [session] = useState<WindowSession>(() => ({ windowId }));
  const [update, setUpdate] = useState<UpdateState>({ status: "idle" });
  const [status, setStatus] = useState<
    "pending" | "active" | "waiting" | "closed"
  >("pending");

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    async function presence() {
      try {
        const { active, update: nextUpdate } = await signalWindow(windowId);
        if (disposed) return;
        setUpdate(nextUpdate);
        // A waiting window must not send a former owner's documents.
        if (!active) delete session.pendingDraft;
        setStatus(active ? "active" : "waiting");
        timer = window.setTimeout(() => {
          void presence();
        }, presenceIntervalMs);
      } catch {
        if (!disposed) setStatus("closed");
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
  }, [windowId, presenceIntervalMs, session]);

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
      <p role="alert">
        Gaetanata si è chiusa. Riaprila dall'icona
        {time
          ? `: le modifiche fino alle ${time} sono nella bozza.`
          : ". Nessuna bozza scritta in questa finestra."}
      </p>
    );
  }
  if (status === "pending") return <p role="status">Apertura di Gaetanata…</p>;
  return (
    <WindowSessionContext value={session}>
      {update.status === "available" && (
        <section
          className="update-banner"
          aria-label="Aggiornamento disponibile"
        >
          <strong>Aggiornamento disponibile: {update.version}</strong>
          <p>{update.notes}</p>
          <button type="button">Installa aggiornamento</button>
        </section>
      )}
      {children}
    </WindowSessionContext>
  );
}
