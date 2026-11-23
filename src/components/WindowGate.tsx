import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { closeWindow, signalWindow } from "../windowApi";

const WindowIdContext = createContext<string | null>(null);

/** The server-issued ownership uses this random, page-local identity. */
export function useWindowId(): string | null {
  return useContext(WindowIdContext);
}

export function WindowGate({
  children,
  presenceIntervalMs = 5_000,
}: {
  children: ReactNode;
  presenceIntervalMs?: number;
}) {
  const [windowId] = useState(() => crypto.randomUUID());
  const [status, setStatus] = useState<
    "pending" | "active" | "waiting" | "closed"
  >("pending");

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    async function presence() {
      try {
        const active = await signalWindow(windowId);
        if (disposed) return;
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
      closeWindow(windowId);
    }
    void presence();
    window.addEventListener("pagehide", pagehide);
    return () => {
      disposed = true;
      clearTimeout(timer);
      window.removeEventListener("pagehide", pagehide);
    };
  }, [windowId, presenceIntervalMs]);

  if (status === "waiting")
    return <p role="status">Gaetanata è già aperta in un'altra finestra</p>;
  if (status === "closed")
    return <p role="alert">Gaetanata si è chiusa. Riaprila dall'icona</p>;
  if (status === "pending") return <p role="status">Apertura di Gaetanata…</p>;
  return <WindowIdContext value={windowId}>{children}</WindowIdContext>;
}
