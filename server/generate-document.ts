import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import type { PatientInput } from "../src/patient.ts";
import type { DietSchema } from "../src/schema.ts";
import { calculateSchema } from "../src/schemaCalc.ts";
import { documentValues } from "./document-values.ts";
import { validateTemplate } from "./template-contract.ts";

/** No I/O or clock: #27 can persist these bytes with the input Schema snapshot. */
export function generateDocument(
  template: Buffer,
  patient: PatientInput,
  schema: DietSchema,
  today: string,
): { bytes: Buffer; filename: string } {
  validateTemplate(template);
  const values = documentValues(
    patient,
    schema,
    calculateSchema(patient, schema, today),
    today,
  );
  const document = new Docxtemplater(new PizZip(template), {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => "",
  });
  document.render(values);
  // Windows restrictions also cover macOS path separators; leave Unicode intact.
  const name =
    Array.from(patient.name, (character) =>
      '<>:"/\\|?*'.includes(character) ||
      character.charCodeAt(0) < 32 ||
      character.charCodeAt(0) === 127
        ? "_"
        : character,
    )
      .join("")
      .replace(/[. ]+$/g, "")
      .slice(0, 180) || "Paziente";
  return {
    bytes: document.getZip().generate({ type: "nodebuffer" }),
    filename: `${name} ${today}.docx`,
  };
}
