import type { PatientInput } from "../src/patient.ts";
import {
  type DietSchema,
  schemaDays,
  schemaProteinSources,
} from "../src/schema.ts";
import {
  cookedSchemaGrams,
  type SchemaCalculation,
  type SchemaIssue,
} from "../src/schemaCalc.ts";
import {
  pizzaOilTemplateValues,
  proteinQuantityTemplateValues,
  templateBlockValueTags,
} from "./template-contract.ts";

export class IncompleteDocumentError extends Error {
  readonly issues: SchemaIssue[];
  constructor(issues: SchemaIssue[]) {
    super(
      `Completa i dati prima di generare il Word: ${issues.map((issue) => issue.message).join(" ")}`,
    );
    this.issues = issues;
  }
}

/** Italian decimals without grouping, rounding or trailing zeroes. */
function formatTemplateNumber(value: number): string {
  return String(value).replace(".", ",");
}

/** Inward-rounded proportional counts from the confirmed baseline (#54). */
function proportionalCount(
  grams: number,
  baselineGrams: number,
  lower: number,
  upper: number,
): string {
  const min = Math.ceil((grams * lower) / baselineGrams);
  const max = Math.floor((grams * upper) / baselineGrams);
  return max > min ? `${min}-${max}` : String(min);
}

/** Pure mapping: units and descriptive text belong exclusively to the template. */
export function documentValues(
  patient: PatientInput,
  schema: DietSchema,
  result: SchemaCalculation,
  today: string,
): Record<string, string | number | boolean> {
  if (!result.ok) throw new IncompleteDocumentError(result.issues);
  const issues: SchemaIssue[] = [];
  if (!patient.name.trim())
    issues.push({ field: "name", message: "Inserisci il nome." });
  if (schema.kcal === null)
    issues.push({ field: "kcal", message: "Inserisci le kcal dieta." });
  const lunch = result.carbohydrates.lunch;
  const dinner = result.carbohydrates.dinner;
  const substitutions = {
    pranzo_pasta_g: lunch.pasta,
    cena_pane_g: dinner.bread,
    pranzo_sost_pane_g: lunch.bread,
    pranzo_sost_patate_g: lunch.potatoes,
    pranzo_sost_pasta_mista_g: lunch.pastaAndBreadPasta,
    pranzo_sost_pane_misto_g: lunch.pastaAndBreadBread,
    pranzo_sost_gnocchi_g: lunch.gnocchi,
    cena_sost_pasta_g: dinner.pasta,
    cena_sost_gallette_g: dinner.riceCakes,
    cena_sost_cracker_g: dinner.crackers,
    cena_sost_patate_g: dinner.potatoes,
  };
  const values: Record<string, string | number | boolean> = {
    data: today.split("-").reverse().join("/"),
    saluto: patient.sex === "male" ? "Gent.mo Sig." : "Gent.ma Sig.ra",
    nome_paziente: patient.name,
    colazione_latte: result.breakfast.choice === "latte",
    colazione_yogurt: result.breakfast.choice === "yogurt",
    colazione_latte_ml:
      result.breakfast.choice === "latte"
        ? result.breakfast.quantity.value
        : 150,
    colazione_yogurt_g:
      result.breakfast.choice === "yogurt"
        ? result.breakfast.quantity.value
        : 125,
    spuntino_frutta_secca_g: result.snacks.nuts.value,
    spuntino_noci_n: proportionalCount(result.snacks.nuts.value, 20, 3, 4),
    spuntino_mandorle_n: proportionalCount(
      result.snacks.nuts.value,
      20,
      10,
      12,
    ),
    spuntino_pistacchi_n: proportionalCount(
      result.snacks.nuts.value,
      20,
      20,
      20,
    ),
    spuntino_arachidi_n: proportionalCount(
      result.snacks.nuts.value,
      20,
      20,
      20,
    ),
    spuntino_yogurt_g: result.snacks.yogurt.value,
    pizza_pane_g: result.pizza.bread.value,
    ...pizzaOilTemplateValues(result.pizza.oil.value),
    pranzo_sost_polenta: lunch.cornmeal !== null,
    pranzo_sost_farina_mais_g: lunch.cornmeal?.value ?? 0,
    cena_sost_gallette_n: proportionalCount(
      dinner.riceCakes?.value ?? 0,
      35,
      3,
      4,
    ),
  };
  for (const [tag, quantity] of Object.entries(substitutions)) {
    if (quantity === null)
      issues.push({ field: tag, message: `Completa la sostituzione ${tag}.` });
    else values[tag] = quantity.value;
  }
  for (const [key, source, tag] of [
    ["whiteMeat", "carne_bianca", "pizza_carne_bianca_g"],
    ["fish", "pesce", "pizza_pesce_g"],
  ] as const) {
    const quantity = result.pizza[key];
    if (quantity === null)
      issues.push({
        field: `pizza.${key}Grams`,
        message: `Inserisci la base della carne rossa o i grammi di ${source} per il pranzo del giorno pizza.`,
      });
    else values[tag] = quantity.value;
  }
  const raw = lunch.pasta?.value ?? 0;
  Object.assign(values, {
    conversione_pasta_cruda_g: raw,
    conversione_pasta_cotta_g: cookedSchemaGrams("pasta", raw),
    conversione_riso_crudo_g: raw,
    conversione_riso_cotto_g: cookedSchemaGrams("rice", raw),
  });
  for (const day of schemaDays) {
    const portions = result.proteinWeek.days.find((entry) => entry.day === day);
    for (const [meal, key] of [
      ["pranzo", "lunch"],
      ["cena", "dinner"],
    ] as const) {
      const portion = portions?.[key];
      if (portion && portion.quantity === null)
        issues.push({
          field: `${day}.${key}.grams`,
          message: `Inserisci i grammi di ${portion.source} per ${day} ${meal}.`,
        });
      for (const source of schemaProteinSources) {
        const block = `${day}_${meal}_${source}`;
        values[block] = portion?.source === source;
        for (const tag of templateBlockValueTags[block] ?? []) values[tag] = 0;
        if (portion?.source === source && portion.quantity)
          Object.assign(
            values,
            proteinQuantityTemplateValues(block, portion.quantity.value),
          );
      }
    }
  }
  if (issues.length) throw new IncompleteDocumentError(issues);
  for (const [tag, value] of Object.entries(values)) {
    if (typeof value === "number") values[tag] = formatTemplateNumber(value);
  }
  return values;
}
