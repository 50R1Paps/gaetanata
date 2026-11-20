import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { describe, expect, it } from "vitest";
import {
  buildSyntheticTemplate,
  pizzaOilTemplateValues,
  proteinQuantityTemplateValues,
  templateBlocks,
  templateBlockValueTags,
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
  it.each([
    [10, 1, 2],
    [15, 1.5, 3],
    [0, 0, 0],
  ])(
    "stampa %s ml di olio pizza con misure casalinghe coerenti",
    (ml, tablespoons, teaspoons) => {
      expect(templateValueTags).not.toContain("olio_ml");
      const doc = new Docxtemplater(new PizZip(buildSyntheticTemplate()), {
        nullGetter: () => "",
      });
      doc.render(pizzaOilTemplateValues(ml));
      const text = doc.getFullText();
      expect(text).toContain(`pizza_olio_ml=${ml}`);
      expect(text).toContain(`pizza_olio_cucchiai=${tablespoons}`);
      expect(text).toContain(`pizza_olio_cucchiaini=${teaspoons}`);
    },
  );

  it("stampa conteggio uova e alternativa stagionata dalle quantità scelte", () => {
    const doc = new Docxtemplater(new PizZip(buildSyntheticTemplate()), {
      nullGetter: () => "",
    });
    doc.render({
      lunedi_pranzo_uova: true,
      lunedi_cena_formaggio_fresco: true,
      ...proteinQuantityTemplateValues("lunedi_pranzo_uova", 180),
      ...proteinQuantityTemplateValues("lunedi_cena_formaggio_fresco", 100),
    });
    expect(doc.getFullText()).toContain("lunedi_pranzo_uova_n=3");
    expect(doc.getFullText()).toContain(
      "lunedi_cena_formaggio_fresco_alt_stagionato_g=50",
    );
    expect(proteinQuantityTemplateValues("lunedi_pranzo_uova", 120)).toEqual({
      lunedi_pranzo_uova_g: 120,
      lunedi_pranzo_uova_n: 2,
    });
  });

  it.each([true, false])(
    "mostra la sostituzione polenta solo se disponibile: %s",
    (available) => {
      const doc = new Docxtemplater(new PizZip(buildSyntheticTemplate()), {
        nullGetter: () => "",
      });
      doc.render({
        pranzo_sost_polenta: available,
        pranzo_sost_farina_mais_g: 70,
      });
      expect(doc.getFullText().includes("pranzo_sost_farina_mais_g=70")).toBe(
        available,
      );
    },
  );
  it.each(["Gent.mo Sig.", "Gent.ma Sig.ra"])(
    "compila il saluto completo %s e solo la fonte scelta",
    (saluto) => {
      const template = buildSyntheticTemplate();
      expect(() => validateTemplate(template)).not.toThrow();
      const data: Record<string, string | number | boolean> = {
        data: "20/11/2026",
        saluto,
        nome_paziente: "Persona Esempio",
        pranzo_pasta_g: 80,
        cena_pane_g: 110,
      };
      for (const day of templateDays) {
        for (const meal of ["pranzo", "cena"]) {
          for (const source of templateProteinSources) {
            data[`${day}_${meal}_${source}`] = source === "uova";
            Object.assign(
              data,
              proteinQuantityTemplateValues(`${day}_${meal}_${source}`, 180),
            );
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
      expect(xml).toContain(saluto);
      expect(xml).toContain("pranzo_pasta_g=80");
      expect(xml).toContain("cena_pane_g=110");
      expect(xml.match(/uova_g=180/g)).toHaveLength(14);
      expect(xml).not.toContain("pesce_g=");
      expect(xml).not.toMatch(/[{}]/);
    },
  );

  it.each(templateProteinSources)(
    "compila la fonte %s e tutti i valori globali",
    (chosen) => {
      const data: Record<string, string | number | boolean> =
        Object.fromEntries(templateValueTags.map((tag) => [tag, 35]));
      for (const block of templateBlocks) {
        data[block] = block.endsWith(`_${chosen}`);
        Object.assign(data, proteinQuantityTemplateValues(block, 78));
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
    for (const [block, values] of Object.entries(templateBlockValueTags)) {
      expect(documentation).toContain(`\`{#${block}}\``);
      expect(documentation).toContain(`\`{/${block}}\``);
      for (const tag of values) expect(documentation).toContain(`\`{${tag}}\``);
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
          Object.assign(data, proteinQuantityTemplateValues(block, 78));
        }
        data.pranzo_sost_polenta = true;
        data.pranzo_sost_farina_mais_g = 70;
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
