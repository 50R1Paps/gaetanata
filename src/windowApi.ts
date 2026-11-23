import type { DraftInput } from "./draftApi";

export async function signalWindow(windowId: string): Promise<boolean> {
  const response = await fetch("/api/window", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ windowId }),
  });
  if (!response.ok) throw new Error("Il server locale non risponde.");
  const body = await response.json();
  if (typeof body.active !== "boolean")
    throw new Error("Risposta finestra non valida.");
  return body.active;
}

export function closeWindow(windowId: string, draft?: DraftInput | null): void {
  void fetch("/api/window/close", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      windowId,
      ...(draft !== undefined ? { draft } : {}),
    }),
    keepalive: true,
  }).catch(() => {
    // A crashed server cannot acknowledge page closure.
  });
}
