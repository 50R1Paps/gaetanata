import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import PizZip from "pizzip";
import { generateDocument } from "../server/generate-document.ts";
import { validateTemplate } from "../server/template-contract.ts";
import {
  emptySchema,
  schemaDays,
  schemaProteinSources,
} from "../src/schema.ts";

const path = process.argv[2];
if (!path) throw new Error("Uso: npm run verify:template -- <percorso.docx>");
const template = await readFile(path);
validateTemplate(template);
for (const source of schemaProteinSources) {
  for (const sex of ["male", "female"] as const) {
    const result = generateDocument(
      template,
      {
        name: "Persona Esempio",
        sex,
        birthDate: "1990-01-01",
        weightKg: 70,
        heightCm: 175,
      },
      {
        ...emptySchema(),
        kcal: 1800,
        proteinWeek: {
          redMeatGrams: 100,
          days: Object.fromEntries(
            schemaDays.map((day) => [
              day,
              { lunch: { source }, dinner: { source } },
            ]),
          ),
        },
      },
      "2026-11-20",
    );
    const xml = new PizZip(result.bytes).file("word/document.xml")?.asText();
    assert.ok(xml);
    const text = [...xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join("");
    assert.ok(!/[{}]/.test(text), "Segnaposto residui nel documento generato.");
  }
}
console.log(
  "Template valido; generazione verificata per tutte le fonti e i saluti. Controllare l'impaginazione in Word.",
);
