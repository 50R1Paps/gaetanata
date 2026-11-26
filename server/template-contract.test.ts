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
      { ...emptySchema(), kcal: 1800, proteinWeek: { redMeatGrams: 100 } },
      "2026-11-20",
    );
    const xml =
      new PizZip(result.bytes).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("nome_paziente=Persona Esempio");
    expect(xml).toContain("data=20/11/2026");
    expect(xml).not.toMatch(/[{}]/);
    expect(xml).not.toContain("pranzo_sost_farina_mais_g=");
  });

  it.each([
    [35, 20, "3-4", "3-4", "10-12", "20"],
    [70, 25, "6-8", "4-5", "13-15", "25"],
    [5, 1, "1", "1", "1", "1"],
    [10, 10, "1", "2", "5-6", "10"],
    [0, 0, "0", "0", "0", "0"],
  ])(
    "renders proportional counts for %i g rice cakes and %i g nuts",
    (riceCakes, nutsGrams, riceCount, walnuts, almonds, otherNuts) => {
      const result = generateDocument(
        buildSyntheticTemplate(),
        {
          name: "Esempio",
          birthDate: "1990-01-01",
          sex: "female",
          weightKg: 60,
          heightCm: 165,
        },
        {
          ...emptySchema(),
          kcal: 1800,
          proteinWeek: { redMeatGrams: 100 },
          snacks: { nutsGrams },
          overrides: { carbohydrates: { dinner: { riceCakes } } },
        },
        "2026-11-26",
      );
      const xml =
        new PizZip(result.bytes).file("word/document.xml")?.asText() ?? "";
      for (const value of [
        `cena_sost_gallette_n=${riceCount}`,
        `cena_sost_gallette_g=${riceCakes}`,
        `spuntino_noci_n=${walnuts}`,
        `spuntino_mandorle_n=${almonds}`,
        `spuntino_pistacchi_n=${otherNuts}`,
        `spuntino_arachidi_n=${otherNuts}`,
        "pizza_carne_bianca_g=130",
        "pizza_pesce_g=150",
      ])
        expect(xml).toContain(value);
    },
  );

  it("refuses missing pizza quantities and accepts manual quantities without a base", () => {
    const patient = {
      name: "Esempio",
      birthDate: "1990-01-01",
      sex: "female" as const,
      weightKg: 60,
      heightCm: 165,
    };
    const schema = { ...emptySchema(), kcal: 1800 };
    expect(() =>
      generateDocument(buildSyntheticTemplate(), patient, schema, "2026-11-26"),
    ).toThrow("Inserisci la base della carne rossa");
    const result = generateDocument(
      buildSyntheticTemplate(),
      patient,
      {
        ...schema,
        pizza: { whiteMeatGrams: 0, fishGrams: 190 },
      },
      "2026-11-26",
    );
    const xml =
      new PizZip(result.bytes).file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("pizza_carne_bianca_g=0");
    expect(xml).toContain("pizza_pesce_g=190");
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
    "pizza_carne_bianca_g",
    "pizza_pesce_g",
    "cena_sost_gallette_n",
    "spuntino_noci_n",
    "spuntino_mandorle_n",
    "spuntino_pistacchi_n",
    "spuntino_arachidi_n",
  ])("richiede anche il tag di sezione %s", (tag) => {
    const zip = new PizZip(buildSyntheticTemplate());
    const xml = zip.file("word/document.xml")?.asText() ?? "";
    zip.file("word/document.xml", xml.replace(`{${tag}}`, ""));
    expect(() =>
      validateTemplate(zip.generate({ type: "nodebuffer" })),
    ).toThrow(tag);
  });
});
