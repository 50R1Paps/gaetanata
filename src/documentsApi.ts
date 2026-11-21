import type { SchemaIssue } from "./schemaCalc.ts";

export type TemplateStatus = { available: boolean };
export type GeneratedDocument = {
  id: number;
  /** Generation instant, ISO 8601 UTC. */
  date: string;
  filename: string;
};
export class DocumentApiError extends Error {
  readonly issues: SchemaIssue[];
  constructor(message: string, issues: SchemaIssue[] = []) {
    super(message);
    this.issues = issues;
  }
}

async function request(path: string, options?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new DocumentApiError("Il server locale non risponde.");
  }
  if (!response.ok) {
    const body = await response.json();
    throw new DocumentApiError(
      body.error ?? `Errore ${response.status}`,
      body.issues ?? [],
    );
  }
  return response;
}

export async function loadTemplateStatus(): Promise<TemplateStatus> {
  return (await request("/api/template")).json();
}

/** Raw DOCX body, not multipart: the file never leaves the local server. */
export async function uploadTemplate(file: Blob): Promise<TemplateStatus> {
  return (await request("/api/template", { method: "PUT", body: file })).json();
}

/** Generate from the patient's saved Schema, not unsaved editor inputs. */
export async function generatePatientDocument(
  id: number,
): Promise<{ blob: Blob; filename: string }> {
  const response = await request(`/api/patients/${id}/document`, {
    method: "POST",
  });
  return readDocument(response);
}

export async function listPatientDocuments(
  patientId: number,
): Promise<GeneratedDocument[]> {
  const body = await (
    await request(`/api/patients/${patientId}/documents`)
  ).json();
  return body.documents;
}

export async function downloadPatientDocument(
  patientId: number,
  documentId: number,
): Promise<{ blob: Blob; filename: string }> {
  return readDocument(
    await request(`/api/patients/${patientId}/documents/${documentId}`),
  );
}

async function readDocument(
  response: Response,
): Promise<{ blob: Blob; filename: string }> {
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(
    response.headers.get("content-disposition") ?? "",
  )?.[1];
  return {
    blob: await response.blob(),
    filename: encoded ? decodeURIComponent(encoded) : "schema.docx",
  };
}
