type PatientJsonSource =
  | { kind: "patient"; patientId: number }
  | { kind: "draft"; patientId: number | null };

/** Native SyntaxError messages can include a fragment of the patient's data. */
export function parsePatientJson<T>(
  text: string,
  source: PatientJsonSource,
): T {
  try {
    return JSON.parse(text);
  } catch {
    const patient =
      source.patientId === null ? "" : ` del paziente ${source.patientId}`;
    throw new Error(
      source.kind === "draft"
        ? `Dati della bozza${patient} non leggibili.`
        : `Dati salvati${patient} non leggibili.`,
    );
  }
}
