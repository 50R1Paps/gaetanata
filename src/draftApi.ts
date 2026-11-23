import type { WeekPlan } from "./plan";
import type { DietSchema } from "./schema";

export type DraftInput = {
  patientId: number | null;
  plan?: WeekPlan;
  schema?: DietSchema;
};
export type Draft = DraftInput & { updatedAt: string };

export async function loadDraft(): Promise<Draft | null> {
  let response: Response;
  try {
    response = await fetch("/api/draft");
  } catch {
    throw new Error("Il server locale non risponde.");
  }
  if (response.status === 404) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Errore ${response.status}`);
  return body;
}

/** Replaces the recovery copy, or removes it when no documents remain. */
export async function writeDraft(
  value: DraftInput,
  windowId: string | null,
): Promise<Draft | null> {
  const hasDocuments = value.plan !== undefined || value.schema !== undefined;
  let response: Response;
  try {
    response = await fetch("/api/draft", {
      method: hasDocuments ? "PUT" : "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...value, ...(windowId ? { windowId } : {}) }),
    });
  } catch {
    throw new Error("Il server locale non risponde.");
  }
  if (response.status === 204) return null;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Errore ${response.status}`);
  return body;
}
