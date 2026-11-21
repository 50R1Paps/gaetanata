import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type CellValue, readTableSheets, type Sheet } from "./xlsx-tables.ts";

const path = process.argv[2];
if (!path) throw new Error("Usage: npm run import:tables -- <path-to-xlsx>");

const workbook = readTableSheets(await readFile(path), [
  "Elenco Alimenti",
  "MET",
]);

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

function sheet(name: string): Sheet {
  const result = workbook.get(name);
  if (!result) throw new Error(`Missing sheet: ${name}`);
  return result;
}

function headerMap(ws: Sheet, rowNumber: number): Map<CellValue, number> {
  const result = new Map<CellValue, number>();
  for (const [index, value] of ws.get(rowNumber) ?? []) {
    if (value !== null) result.set(value, index);
  }
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
for (const [index, row] of foodSheet) {
  if (index === 1) continue;
  const name = row.get(nameColumn) ?? null;
  if (name == null || name === "") continue;
  if (typeof name !== "string")
    throw new Error(`Invalid food name at row ${index}`);
  if (names.has(name)) throw new Error(`Duplicate food name: ${name}`);
  names.add(name);
  const food: Record<string, string | number | null> = {};
  for (const [key, col] of foodColumns) {
    const raw = row.get(col) ?? null;
    // Excel errors and uncertain textual values are unavailable, not zeros.
    food[key] = key === "name" ? name : typeof raw === "number" ? raw : null;
  }
  foods.push(food);
}

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
for (const [index, row] of metSheet) {
  if (index <= 2) continue;
  const activity = row.get(activityColumn) ?? null;
  if (activity == null || activity === "") continue;
  const met = row.get(metColumn) ?? null;
  if (typeof activity !== "string" || typeof met !== "number") {
    throw new Error(`Invalid MET data at row ${index}`);
  }
  activities.push({
    activity,
    detail: row.get(detailColumn) ?? null,
    pace: row.get(paceColumn) ?? null,
    met,
  });
}

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
