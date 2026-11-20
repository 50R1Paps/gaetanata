import type { WeekPlan } from "./plan";

async function request(id: number, plan?: WeekPlan): Promise<WeekPlan> {
  let response: Response;
  try {
    response = await fetch(`/api/patients/${id}/plan`, {
      method: plan ? "PUT" : "GET",
      headers: plan ? { "content-type": "application/json" } : {},
      body: plan ? JSON.stringify(plan) : null,
    });
  } catch {
    throw new Error("Il server locale non risponde.");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Errore ${response.status}`);
  return body;
}

export const loadPlan = (id: number) => request(id);
export const savePlan = (id: number, plan: WeekPlan) => request(id, plan);
