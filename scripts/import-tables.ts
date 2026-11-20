import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ExcelJS, { type Cell, type Worksheet } from "exceljs";

const path = process.argv[2];
if (!path) throw new Error("Usage: npm run import:tables -- <path-to-xlsx>");

const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(path);

// Keys encode the units used by the original per-100-g table.
const columns = {
  Alimenti: "name",
  grammi: "referenceGrams",
  Calorie: "caloriesKcal",
  Carboidrati: "carbohydratesG",
  Lipidi: "fatG",
  Proteine: "proteinG",
  Zuccheri: "sugarsG",
  Saturi: "saturatedFatG",
  "Fibra tot.": "fiberG",
  "Fibra solubile": "solubleFiberG",
  "Fibra insolubile": "insolubleFiberG",
  "Sodio (mg)": "sodiumMg",
  "Potassio (mg)": "potassiumMg",
  "Calcio (mg)": "calciumMg",
  "Magnesio (mg)": "magnesiumMg",
  "Fosforo (mg)": "phosphorusMg",
  "Ferro (mg)": "ironMg",
  "Rame (mg)": "copperMg",
  "Zinco (mg)": "zincMg",
  "Selenio (μg)": "seleniumMcg",
  "B1 (mg)": "vitaminB1Mg",
  "B2 (mg)": "vitaminB2Mg",
  "B3 (mg)": "vitaminB3Mg",
  "B6 (mg)": "vitaminB6Mg",
  "B12 (μg)": "vitaminB12Mcg",
  "Vit. C (mg)": "vitaminCMg",
  "Vit. A (μg)": "vitaminAMcg",
  "B9 (μg)": "vitaminB9Mcg",
  "Vit. D (μg)": "vitaminDMcg",
  "Vit. E (mg)": "vitaminEMg",
  Monoinsaturi: "monounsaturatedFatG",
  PUFA: "polyunsaturatedFatG",
  EPA: "epaG",
  DHA: "dhaG",
  Leucina: "leucineG",
  Isoleucina: "isoleucineG",
  Valina: "valineG",
  "A. Fitico": "phyticAcidG",
} as const;

type CellValue = string | number | boolean | Date | null;

function value(cell: Cell): CellValue {
  const v = cell.value;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    if ("result" in v) return (v.result as CellValue | undefined) ?? null;
    if ("richText" in v) return v.richText.map((part) => part.text).join("");
    if ("error" in v) return null;
    if ("text" in v) return v.text;
    return null;
  }
  return v ?? null;
}

function sheet(name: string): Worksheet {
  const result = workbook.getWorksheet(name);
  if (!result) throw new Error(`Missing sheet: ${name}`);
  return result;
}

function headerMap(ws: Worksheet, rowNumber: number): Map<CellValue, number> {
  const result = new Map<CellValue, number>();
  ws.getRow(rowNumber).eachCell((cell, index) =>
    result.set(value(cell), index),
  );
  return result;
}

function column(headers: Map<CellValue, number>, header: string): number {
  const index = headers.get(header);
  if (index === undefined) throw new Error(`Missing column: ${header}`);
  return index;
}

const foodSheet = sheet("Elenco Alimenti");
const foodHeaders = headerMap(foodSheet, 1);
const foodColumns = Object.entries(columns).map(
  ([header, key]) => [key, column(foodHeaders, header)] as const,
);
const nameColumn = column(foodHeaders, "Alimenti");
const foods: Record<string, string | number | null>[] = [];
const names = new Set<string>();
foodSheet.eachRow((row, index) => {
  if (index === 1) return;
  const name = value(row.getCell(nameColumn));
  if (name == null || name === "") return;
  if (typeof name !== "string")
    throw new Error(`Invalid food name at row ${index}`);
  if (names.has(name)) throw new Error(`Duplicate food name: ${name}`);
  names.add(name);
  const food: Record<string, string | number | null> = {};
  for (const [key, col] of foodColumns) {
    const raw = value(row.getCell(col));
    // Excel errors and uncertain textual values are unavailable, not zeros.
    food[key] = key === "name" ? name : typeof raw === "number" ? raw : null;
  }
  foods.push(food);
});

const metSheet = sheet("MET");
const metHeaders = headerMap(metSheet, 2);
const activityColumn = column(metHeaders, "Attività");
const detailColumn = column(metHeaders, "Dettaglio");
const paceColumn = column(metHeaders, "Ritmo");
const metColumn = column(metHeaders, "MET");
const activities: {
  activity: string;
  detail: CellValue;
  pace: CellValue;
  met: number;
}[] = [];
metSheet.eachRow((row, index) => {
  if (index <= 2) return;
  const activity = value(row.getCell(activityColumn));
  if (activity == null || activity === "") return;
  const met = value(row.getCell(metColumn));
  if (typeof activity !== "string" || typeof met !== "number") {
    throw new Error(`Invalid MET data at row ${index}`);
  }
  activities.push({
    activity,
    detail: value(row.getCell(detailColumn)),
    pace: value(row.getCell(paceColumn)),
    met,
  });
});

for (const [name, data] of [
  ["foods", foods],
  ["met", activities],
] as const) {
  await writeFile(
    fileURLToPath(new URL(`../src/data/${name}.json`, import.meta.url)),
    `${JSON.stringify(data, null, 2)}\n`,
  );
}
console.log(
  `Imported ${foods.length} foods and ${activities.length} MET activities.`,
);
