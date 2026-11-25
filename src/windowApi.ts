import type { DraftInput } from "./draftApi";
import type { UpdateState } from "./update";

export async function signalWindow(
  windowId: string,
): Promise<{ active: boolean; update: UpdateState }> {
  const response = await fetch("/api/window", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ windowId }),
  });
  if (!response.ok) throw new Error("Il server locale non risponde.");
  const body = await response.json();
  if (typeof body.active !== "boolean")
    throw new Error("Risposta finestra non valida.");
  const update: UpdateState =
    body.update?.status === "available" &&
    typeof body.update.version === "string" &&
    typeof body.update.notes === "string"
      ? body.update
      : body.update?.status === "progress" &&
          ["scarico", "installo", "preparo", "riavvio"].includes(
            body.update.step,
          ) &&
          typeof body.update.from === "string" &&
          typeof body.update.version === "string"
        ? body.update
        : body.update?.status === "failed" &&
            typeof body.update.message === "string"
          ? body.update
          : { status: "idle" };
  return { active: body.active, update };
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
