import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  buildSyntheticTemplate,
  templateBlocks,
  templateDays,
  templateProteinSources,
  templateValueTags,
  validateTemplate,
} from "./template-contract.ts";

const localTemplate =
  process.env.GAETANATA_TEMPLATE_PATH ??
  join(
    homedir(),
    "Downloads",
    "TEMPLATO DIETE - Settimanale (segnaposto).docx",
  );

describe("contratto del template Word", () => {
  it("compila dati anonimi e mostra solo la fonte scelta in ogni pasto", () => {
    const template = buildSyntheticTemplate();
    expect(() => validateTemplate(template)).not.toThrow();
    const data: Record<string, string | number | boolean> = {
      data: "20/11/2026",
      saluto: "Gent.ma",
      nome_paziente: "Persona Esempio",
      pranzo_pasta_g: 80,
      cena_pane_g: 110,
    };
    for (const day of templateDays) {
      for (const meal of ["pranzo", "cena"]) {
        for (const source of templateProteinSources) {
          data[`${day}_${meal}_${source}`] = source === "uova";
          data[`${day}_${meal}_${source}_g`] = 180;
        }
      }
    }
    const doc = new Docxtemplater(new PizZip(template), {
      nullGetter: () => "",
      paragraphLoop: true,
    });
    doc.render(data);
    const xml = doc.getZip().file("word/document.xml")?.asText() ?? "";
    expect(xml).toContain("Persona Esempio");
    expect(xml).toContain("20/11/2026");
    expect(xml).toContain("Gent.ma");
    expect(xml).toContain("pranzo_pasta_g=80");
    expect(xml).toContain("cena_pane_g=110");
    expect(xml.match(/uova=180/g)).toHaveLength(14);
    expect(xml).not.toContain("pesce=");
    expect(xml).not.toMatch(/[{}]/);
  });

  it.each(templateProteinSources)(
    "compila la fonte %s e tutti i valori globali",
    (chosen) => {
      const data: Record<string, string | number | boolean> =
        Object.fromEntries(templateValueTags.map((tag) => [tag, 35]));
      for (const block of templateBlocks) {
        data[block] = block.endsWith(`_${chosen}`);
        data[`${block}_g`] = 78;
      }
      const doc = new Docxtemplater(new PizZip(buildSyntheticTemplate()));
      doc.render(data);
      const xml = doc.getZip().file("word/document.xml")?.asText() ?? "";
      for (const tag of templateValueTags) expect(xml).toContain(`${tag}=35`);
      expect(xml.match(/=78/g)).toHaveLength(14);
      expect(xml).not.toMatch(/[{}]/);
    },
  );

  it("documenta tutti i tag e le sezioni del contratto", () => {
    const documentation = readFileSync(
      new URL("../docs/template-segnaposto.md", import.meta.url),
      "utf8",
    );
    for (const tag of templateValueTags)
      expect(documentation).toContain(`\`{${tag}}\``);
    for (const block of templateBlocks) {
      expect(documentation).toContain(`\`{#${block}}\``);
      expect(documentation).toContain(`\`{/${block}}\``);
      expect(documentation).toContain(`\`{${block}_g}\``);
    }
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

  it.skipIf(!existsSync(localTemplate))(
    "verifica tag e sintassi della copia locale, se presente",
    () => {
      const bytes = readFileSync(localTemplate);
      expect(() => validateTemplate(bytes)).not.toThrow();
      for (const chosen of templateProteinSources) {
        const data: Record<string, number | boolean> = Object.fromEntries(
          templateValueTags.map((tag) => [tag, 35]),
        );
        for (const block of templateBlocks) {
          data[block] = block.endsWith(`_${chosen}`);
          data[`${block}_g`] = 78;
        }
        const doc = new Docxtemplater(new PizZip(bytes), {
          nullGetter: () => {
            throw new Error("Tag non documentato nel template locale");
          },
        });
        doc.render(data);
        expect(doc.getFullText()).not.toMatch(/[{}]/);
      }
    },
  );
});
