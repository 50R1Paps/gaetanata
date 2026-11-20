import type { DietSchema } from "./schema";

async function request(id: number, schema?: DietSchema): Promise<DietSchema> {
  let response: Response;
  try {
    response = await fetch(`/api/patients/${id}/schema`, {
      method: schema ? "PUT" : "GET",
      headers: schema ? { "content-type": "application/json" } : {},
      body: schema ? JSON.stringify(schema) : null,
    });
  } catch {
    throw new Error("Il server locale non risponde.");
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? `Errore ${response.status}`);
  return body;
}

export const loadSchema = (id: number) => request(id);
export const saveSchema = (id: number, schema: DietSchema) =>
  request(id, schema);
