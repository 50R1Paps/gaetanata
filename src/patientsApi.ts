import type { FieldErrors, Patient, PatientInput } from "./patient";

/** A failed API call; `fields` holds the server's per-field messages. */
export class ApiError extends Error {
  readonly fields: FieldErrors;
  readonly status: number;
  constructor(message: string, fields: FieldErrors = {}, status = 0) {
    super(message);
    this.fields = fields;
    this.status = status;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: PatientInput,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("il server locale non risponde. L'app è ancora aperta?");
  }
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok)
    throw new ApiError(
      data?.error ?? `errore ${response.status}`,
      data?.fields ?? {},
      response.status,
    );
  return data as T;
}

export async function listPatients(): Promise<Patient[]> {
  return (await request<{ patients: Patient[] }>("GET", "/api/patients"))
    .patients;
}

export function createPatient(input: PatientInput): Promise<Patient> {
  return request("POST", "/api/patients", input);
}

export function updatePatient(
  id: number,
  input: PatientInput,
): Promise<Patient> {
  return request("PUT", `/api/patients/${id}`, input);
}

export function deletePatient(id: number): Promise<void> {
  return request("DELETE", `/api/patients/${id}`);
}
