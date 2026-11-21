import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import { emptySchema } from "../src/schema.ts";
import { generateDocument } from "./generate-document.ts";
import {
  buildSyntheticTemplate,
  validateTemplate,
} from "./template-contract.ts";

describe("contratto del template Word", () => {
  it("generates a complete synthetic document and hides unavailable polenta", () => {
    const result = generateDocument(
      buildSyntheticTemplate(),
      {
        name: "Persona Esempio",
        birthDate: "1990-01-01",
        sex: "female",
        weightKg: 60,
        heightCm: 165,
      },
      { ...emptySchema(), kcal: 1800 },
      "2026-11-20",
    );
    const xml =
      new PizZip(result.bytes).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("nome_paziente=Persona Esempio");
    expect(xml).toContain("data=20/11/2026");
    expect(xml).not.toMatch(/[{}]/);
    expect(xml).not.toContain("pranzo_sost_farina_mais_g=");
  });

  it("rifiuta un valore globale o una quantità mancante nel blocco", () => {
    const zip = new PizZip(buildSyntheticTemplate());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    zip.file("word/document.xml", xml.replace("{data}", ""));
    expect(() =>
      validateTemplate(zip.generate({ type: "nodebuffer" })),
    ).toThrow("data");
    zip.file("word/document.xml", xml.replace("{lunedi_pranzo_uova_g}", ""));
    expect(() =>
      validateTemplate(zip.generate({ type: "nodebuffer" })),
    ).toThrow("lunedi_pranzo_uova");
  });

  it("riconosce anche i tag spezzati in più run da Word", () => {
    const zip = new PizZip(buildSyntheticTemplate());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    zip.file(
      "word/document.xml",
      xml.replace("{data}", "{da</w:t></w:r><w:r><w:t>ta}"),
    );
    expect(() =>
      validateTemplate(zip.generate({ type: "nodebuffer" })),
    ).not.toThrow();
  });

  it.each([
    "lunedi_pranzo_uova_n",
    "lunedi_cena_formaggio_fresco_alt_stagionato_g",
    "pranzo_sost_farina_mais_g",
  ])("richiede anche il tag di sezione %s", (tag) => {
    const zip = new PizZip(buildSyntheticTemplate());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    zip.file("word/document.xml", xml.replace(`{${tag}}`, ""));
    expect(() =>
      validateTemplate(zip.generate({ type: "nodebuffer" })),
    ).toThrow(tag);
  });
});
