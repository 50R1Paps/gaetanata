import Docxtemplater from "docxtemplater";
import InspectModule from "docxtemplater/js/inspect-module.js";
import PizZip from "pizzip";

export const templateDays = [
  "lunedi",
  "martedi",
  "mercoledi",
  "giovedi",
  "venerdi",
  "sabato",
  "domenica",
] as const;
export const templateProteinSources = [
  "uova",
  "pesce",
  "carne_bianca",
  "carne_rossa",
  "legumi_secchi",
  "legumi_scatola",
  "formaggio_fresco",
  "formaggio_stagionato",
  "affettati",
  "pesce_scatola",
] as const;
export const templateValueTags = [
  "data",
  "saluto",
  "nome_paziente",
  "olio_ml",
  "pizza_pane_g",
  "pizza_olio_ml",
  "pranzo_pasta_g",
  "cena_pane_g",
  "cena_gallette_g",
  "pranzo_sost_pane_g",
  "pranzo_sost_patate_g",
  "pranzo_sost_pasta_mista_g",
  "pranzo_sost_pane_misto_g",
  "pranzo_sost_gnocchi_g",
  "pranzo_sost_farina_mais_g",
  "cena_sost_pasta_g",
  "cena_sost_gallette_g",
  "cena_sost_cracker_g",
  "cena_sost_patate_g",
  "conversione_pasta_cruda_g",
  "conversione_pasta_cotta_g",
  "conversione_riso_crudo_g",
  "conversione_riso_cotto_g",
] as const;
export const templateBlocks = templateDays.flatMap((day) =>
  ["pranzo", "cena"].flatMap((meal) =>
    templateProteinSources.map((source) => `${day}_${meal}_${source}`),
  ),
);

/** Compile first: Word may split a tag across multiple text runs. */
export function validateTemplate(bytes: Buffer): void {
  const inspect = new InspectModule();
  new Docxtemplater(new PizZip(bytes), {
    modules: [inspect],
    paragraphLoop: true,
  });
  const tags = inspect.getAllTags();
  const missing: string[] = templateValueTags.filter((tag) => !(tag in tags));
  for (const block of templateBlocks) {
    const children = tags[block];
    if (
      typeof children !== "object" ||
      children === null ||
      !(`${block}_g` in children)
    ) {
      missing.push(block);
    }
  }
  if (missing.length)
    throw new Error(
      `Segnaposto mancanti o blocchi incompleti: ${missing.join(", ")}`,
    );
}

/** Anonymous fixture, created in memory: never reads the institute document. */
export function buildSyntheticTemplate(): Buffer {
  const zip = new PizZip();
  zip.file(
    "[Content_Types].xml",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  );
  zip.file(
    "_rels/.rels",
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  );
  const paragraphs = [
    ...templateValueTags.map((tag) => `${tag}={${tag}}`),
    ...templateBlocks.map(
      (block) => `{#${block}}${block}={${block}_g}{/${block}}`,
    ),
  ]
    .map((text) => `<w:p><w:r><w:t>${text}</w:t></w:r></w:p>`)
    .join("");
  zip.file(
    "word/document.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`,
  );
  return zip.generate({ type: "nodebuffer" });
}
