// Shared by the browser and the local server (imported with a `.ts` path):
// keep it free of imports so Node's type stripping can load it directly.

export type Sex = "male" | "female";

/** Patient record ("scheda paziente"): only the name is required, the rest
 * can be completed later. Dates are ISO `YYYY-MM-DD`. */
export type PatientInput = {
  name: string;
  birthDate: string | null;
  sex: Sex | null;
  weightKg: number | null;
  heightCm: number | null;
};

export type Patient = { id: number } & PatientInput;

export type PatientField = keyof PatientInput;
export type FieldErrors = Partial<Record<PatientField, string>>;
export type Validation =
  | { ok: true; value: PatientInput }
  | { ok: false; errors: FieldErrors };

/** What the form fields hold: text as typed, numbers with "," or ".". */
export type PatientForm = Record<Exclude<PatientField, "sex">, string> & {
  sex: Sex | "";
};

export const emptyPatientForm: PatientForm = {
  name: "",
  birthDate: "",
  sex: "",
  weightKg: "",
  heightCm: "",
};

/** Today's date on this computer as `YYYY-MM-DD`. */
export function localToday(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Validates untrusted data (an API body or a parsed form). Absent optional
 * fields are null; `today` is `YYYY-MM-DD`. */
export function validatePatient(data: unknown, today: string): Validation {
  const input = (
    typeof data === "object" && data !== null ? data : {}
  ) as Record<string, unknown>;
  const errors: FieldErrors = {};

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name === "") errors.name = "Inserisci il nome.";

  const birthDate = input.birthDate ?? null;
  if (birthDate !== null) {
    if (typeof birthDate !== "string" || !isCalendarDate(birthDate))
      errors.birthDate = "Data di nascita non valida.";
    else if (birthDate > today)
      errors.birthDate = "La data di nascita non può essere nel futuro.";
  }

  const sex = input.sex ?? null;
  if (sex !== null && sex !== "male" && sex !== "female")
    errors.sex = "Sesso non valido: scegli maschio o femmina.";

  const weightKg = input.weightKg ?? null;
  const weightError = positiveNumberError(weightKg, "Il peso");
  if (weightError) errors.weightKg = weightError;

  const heightCm = input.heightCm ?? null;
  const heightError = positiveNumberError(heightCm, "L'altezza");
  if (heightError) errors.heightCm = heightError;

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      birthDate: birthDate as string | null,
      sex: sex as Sex | null,
      weightKg: weightKg as number | null,
      heightCm: heightCm as number | null,
    },
  };
}

/** Turns the form into a patient, with the same rules as the server. */
export function parsePatientForm(form: PatientForm, today: string): Validation {
  return validatePatient(
    {
      name: form.name,
      birthDate: form.birthDate.trim() || null,
      sex: form.sex || null,
      weightKg: parseDecimal(form.weightKg),
      heightCm: parseDecimal(form.heightCm),
    },
    today,
  );
}

export function patientToForm(patient: PatientInput): PatientForm {
  const decimal = (value: number | null) =>
    value === null ? "" : String(value).replace(".", ",");
  return {
    name: patient.name,
    birthDate: patient.birthDate ?? "",
    sex: patient.sex ?? "",
    weightKg: decimal(patient.weightKg),
    heightCm: decimal(patient.heightCm),
  };
}

/** Empty → null, "62,5" or "62.5" → 62.5; anything else stays text so the
 * validator reports it as not a number. */
function parseDecimal(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const value = Number(trimmed.replace(",", "."));
  return /^[-+]?(\d+([.,]\d*)?|[.,]\d+)$/.test(trimmed) &&
    Number.isFinite(value)
    ? value
    : trimmed;
}

function positiveNumberError(value: unknown, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value))
    return `${label} deve essere un numero.`;
  if (value <= 0) return `${label} deve essere maggiore di zero.`;
  return null;
}

function isCalendarDate(text: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number) as [
    number,
    number,
    number,
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}
