/** Persisted Schema interface (shared browser/server; no runtime imports).
 * emptySchema() creates independent defaults; kcal is deliberately unset.
 * Save ONLY this input model, never calculateSchema's result. Removing an
 * override key restores the calculation (0 is an intentional override).
 * Version 1 can grow optional input sections for days/protein/pizza (#24) and
 * breakfast/snacks (#25); absent sections must retain their future defaults.
 * No WeekPlan or patient copy is embedded: patient data is read at calculation.
 */
export type SchemaMealCount = 3 | 4 | 5 | 6;
export const schemaMealSlots = [
  "breakfast",
  "morningSnack",
  "lunch",
  "afternoonSnack",
  "dinner",
  "lateSnack",
] as const;
export type SchemaMealSlot = (typeof schemaMealSlots)[number];
export type SchemaMacros = {
  carbohydrates: number;
  fat: number;
  protein: number;
};
export const substitutionKeys = [
  "pasta",
  "bread",
  "potatoes",
  "pastaAndBreadPasta",
  "pastaAndBreadBread",
  "gnocchi",
  "cornmeal",
  "riceCakes",
  "crackers",
] as const;
export type SubstitutionKey = (typeof substitutionKeys)[number];
export type SchemaOverrides = {
  meals?: Partial<Record<SchemaMealSlot, Partial<SchemaMacros>>>;
  carbohydrates?: Partial<
    Record<"lunch" | "dinner", Partial<Record<SubstitutionKey, number>>>
  >;
};
export type DietSchema = {
  version: 1;
  kcal: number | null;
  laf: number;
  mealCount: SchemaMealCount;
  macroPercent: SchemaMacros;
  overrides: SchemaOverrides;
};
export function emptySchema(): DietSchema {
  return {
    version: 1,
    kcal: null,
    laf: 1.4,
    mealCount: 5,
    macroPercent: { carbohydrates: 50, fat: 30, protein: 20 },
    overrides: {},
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function keys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
const macroKeys = ["carbohydrates", "fat", "protein"];
function numbers(value: unknown, allowed: readonly string[]): boolean {
  return (
    record(value) &&
    keys(value, allowed) &&
    Object.values(value).every(nonnegative)
  );
}
/** Rejects unknown/computed fields, invalid settings and negative corrections.
 * A draft with kcal=null is valid for persistence, not for calculation. */
export function isDietSchema(value: unknown): value is DietSchema {
  if (
    !record(value) ||
    !keys(value, [
      "version",
      "kcal",
      "laf",
      "mealCount",
      "macroPercent",
      "overrides",
    ])
  )
    return false;
  if (
    value.version !== 1 ||
    !(value.kcal === null || (nonnegative(value.kcal) && value.kcal > 0)) ||
    !nonnegative(value.laf) ||
    value.laf === 0 ||
    ![3, 4, 5, 6].includes(Number(value.mealCount)) ||
    typeof value.mealCount !== "number"
  )
    return false;
  const macro = value.macroPercent;
  if (
    !record(macro) ||
    !numbers(macro, macroKeys) ||
    macroKeys.some((key) => !(key in macro))
  )
    return false;
  if (
    Math.abs(
      Number(macro.carbohydrates) +
        Number(macro.fat) +
        Number(macro.protein) -
        100,
    ) > 1e-8
  )
    return false;
  const overrides = value.overrides;
  if (!record(overrides) || !keys(overrides, ["meals", "carbohydrates"]))
    return false;
  if (
    overrides.meals !== undefined &&
    (!record(overrides.meals) ||
      !keys(overrides.meals, schemaMealSlots) ||
      !Object.values(overrides.meals).every((value) =>
        numbers(value, macroKeys),
      ))
  )
    return false;
  if (
    overrides.carbohydrates !== undefined &&
    (!record(overrides.carbohydrates) ||
      !keys(overrides.carbohydrates, ["lunch", "dinner"]) ||
      !Object.values(overrides.carbohydrates).every((value) =>
        numbers(value, substitutionKeys),
      ))
  )
    return false;
  return true;
}
