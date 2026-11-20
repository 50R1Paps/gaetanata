/** Pure Schema calculation interface for screens and document generation.
 * calculateSchema(patient, inputs, today) accepts PatientInput, DietSchema and
 * an explicit ISO date (no clock/I/O). Invalid/missing data => {ok:false,issues}
 * with no numeric results. Success includes metabolism, fabbisogno, ordered
 * meals, substitutions and protein/kg for real and ALL existing ideal weights;
 * no ideal-weight formula is silently chosen. Warnings use inclusive 1.2–1.4.
 * Quantity = {calculated,value,overridden}; delete the corresponding input
 * override to undo it. Macro overrides are grams; food overrides are grams.
 * kcal reflect the prescribed allocation, not reconstructed rounded grams.
 * Lunch/dinner carbohydrate grams share the rounded mean of their unrounded
 * allocations; a manual meal override can intentionally break that equality.
 * Substitutions follow effective meal carbohydrate grams, independently rounded
 * to 5 g. Unavailable food-table substitutions are null + an explicit warning.
 * Protein/kg sums unrounded meal protein allocations, replacing each manually
 * overridden meal with its entered grams. Display rounding alone has no effect.
 * Store only DietSchema, never this result. #24/#25 add optional input sections.
 */
import {
  ageAt,
  basalMetabolism,
  idealWeights,
  type MetabolismFormula,
} from "./calc";
import foods from "./data/foods.json";
import { type PatientInput, validatePatient } from "./patient";
import {
  type DietSchema,
  isDietSchema,
  type SchemaMacros,
  type SchemaMealCount,
  type SchemaMealSlot,
  type SubstitutionKey,
} from "./schema";

export type SchemaQuantity = {
  calculated: number;
  value: number;
  overridden: boolean;
};
export type SchemaIssue = { field: string; message: string };
export type SchemaMeal = {
  slot: SchemaMealSlot;
  percent: number;
  kcal: number;
  macroKcal: SchemaMacros;
  grams: Record<keyof SchemaMacros, SchemaQuantity>;
};
export type SchemaIdealBasis = "bmi225" | "bmi25" | "lorenz";
export type SchemaWarning =
  | {
      code: "protein-low" | "protein-high";
      basis: "real" | SchemaIdealBasis;
      value: number;
    }
  | { code: "substitution-unavailable"; substitution: SubstitutionKey };
export type SchemaCalculation =
  | { ok: false; issues: SchemaIssue[] }
  | {
      ok: true;
      metabolism: {
        formula: MetabolismFormula;
        kcal: number;
        formulas: Record<MetabolismFormula, number>;
      };
      fabbisogno: number;
      meals: SchemaMeal[];
      carbohydrates: Record<
        "lunch" | "dinner",
        Record<SubstitutionKey, SchemaQuantity | null>
      >;
      protein: {
        grams: number;
        real: number;
        ideal: Record<
          SchemaIdealBasis,
          { weightKg: number; gramsPerKg: number }
        >;
      };
      warnings: SchemaWarning[];
    };

const allocations: Record<
  SchemaMealCount,
  readonly [SchemaMealSlot, number][]
> = {
  3: [
    ["breakfast", 20],
    ["lunch", 45],
    ["dinner", 35],
  ],
  4: [
    ["breakfast", 20],
    ["lunch", 40],
    ["afternoonSnack", 10],
    ["dinner", 30],
  ],
  5: [
    ["breakfast", 20],
    ["morningSnack", 5],
    ["lunch", 40],
    ["afternoonSnack", 5],
    ["dinner", 30],
  ],
  6: [
    ["breakfast", 15],
    ["morningSnack", 5],
    ["lunch", 35],
    ["afternoonSnack", 5],
    ["dinner", 35],
    ["lateSnack", 5],
  ],
};
const macroKeys = ["carbohydrates", "fat", "protein"] as const;
const required = {
  birthDate: "data di nascita",
  sex: "sesso",
  weightKg: "peso",
  heightCm: "altezza",
} as const;
const foodNames = {
  gnocchi: "Gnocchi di patate (crudi)",
  cornmeal: "Farina di mais",
  riceCakes: "Gallette di riso",
  crackers: "Crackers",
};
/** Food-table fractions, NOT sheet coefficients. Missing matches stay null. */
export const substitutionReferences = Object.fromEntries(
  Object.entries(foodNames).map(([key, name]) => {
    const food = foods.find((food) => food.name === name);
    return [
      key,
      {
        food: name,
        carbohydrateFraction: food?.carbohydratesG
          ? food.carbohydratesG / 100
          : null,
      },
    ];
  }),
) as Record<
  keyof typeof foodNames,
  { food: string; carbohydrateFraction: number | null }
>;

/** Positive half-way values round up, matching the sheet. */
export function roundSchemaGrams(grams: number): number {
  return Math.round(grams / 5) * 5;
}
/** ADR 0005 raw-to-cooked conversion; no other cooked factors are assumed. */
export function cookedSchemaGrams(
  food: "pasta" | "rice",
  rawGrams: number,
): number {
  return rawGrams * (food === "pasta" ? 2 : 2.5);
}
function quantity(
  calculated: number,
  override: number | undefined,
): SchemaQuantity {
  return {
    calculated,
    value: override ?? calculated,
    overridden: override !== undefined,
  };
}

export function calculateSchema(
  patient: PatientInput,
  schema: DietSchema,
  today: string,
): SchemaCalculation {
  const issues: SchemaIssue[] = [];
  const validated = validatePatient({ ...patient, name: "Schema" }, today);
  if (!validated.ok) {
    for (const [field, message] of Object.entries(validated.errors))
      issues.push({ field, message });
  }
  for (const [field, label] of Object.entries(required)) {
    if (patient[field as keyof typeof required] == null)
      issues.push({ field, message: `Completa ${label}.` });
  }
  if (!validatePatient({ name: "Schema", birthDate: today }, today).ok)
    issues.push({ field: "today", message: "Data di calcolo non valida." });
  if (!isDietSchema(schema))
    issues.push({
      field: "schema",
      message: "Impostazioni o correzioni dello schema non valide.",
    });
  else if (schema.kcal === null)
    issues.push({ field: "kcal", message: "Inserisci le kcal dieta." });
  if (
    issues.length ||
    !validated.ok ||
    !patient.sex ||
    !patient.birthDate ||
    !patient.weightKg ||
    !patient.heightCm ||
    schema.kcal === null
  )
    return { ok: false, issues };
  const { sex, weightKg, heightCm } = patient;
  const metabolism = basalMetabolism({
    sex,
    weightKg,
    heightCm,
    age: ageAt(new Date(patient.birthDate), new Date(today)),
  });
  const weights = idealWeights(heightCm, weightKg, sex);
  const fabbisogno = metabolism.kcal * schema.laf;
  if (
    Object.values(metabolism.formulas).some(
      (n) => !Number.isFinite(n) || n <= 0,
    ) ||
    !Number.isFinite(fabbisogno) ||
    Object.values(weights).some(
      (w) => !Number.isFinite(w.weight) || w.weight <= 0,
    )
  )
    return {
      ok: false,
      issues: [
        {
          field: "patient",
          message:
            "Controlla i dati del paziente: i risultati non sono validi.",
        },
      ],
    };
  const allocation = allocations[schema.mealCount];
  const lunchDinnerPercent = allocation.reduce(
    (sum, [slot, percent]) =>
      sum + (slot === "lunch" || slot === "dinner" ? percent : 0),
    0,
  );
  const sharedCarbs = roundSchemaGrams(
    (((schema.kcal * schema.macroPercent.carbohydrates) / 100 / 4) *
      lunchDinnerPercent) /
      100 /
      2,
  );
  const meals = allocation.map(([slot, percent]): SchemaMeal => {
    const kcal = ((schema.kcal as number) * percent) / 100;
    const macroKcal = {
      carbohydrates: (kcal * schema.macroPercent.carbohydrates) / 100,
      fat: (kcal * schema.macroPercent.fat) / 100,
      protein: (kcal * schema.macroPercent.protein) / 100,
    };
    const grams = Object.fromEntries(
      macroKeys.map((key) => [
        key,
        quantity(
          key === "carbohydrates" && (slot === "lunch" || slot === "dinner")
            ? sharedCarbs
            : roundSchemaGrams(macroKcal[key] / (key === "fat" ? 9 : 4)),
          schema.overrides.meals?.[slot]?.[key],
        ),
      ]),
    ) as SchemaMeal["grams"];
    return { slot, percent, kcal, macroKcal, grams };
  });
  const warnings: SchemaWarning[] = [];
  function substitutions(slot: "lunch" | "dinner") {
    const carbs =
      meals.find((meal) => meal.slot === slot)?.grams.carbohydrates.value ?? 0;
    const fractions: Record<SubstitutionKey, number | null> = {
      pasta: 0.75,
      bread: 0.55,
      potatoes: 0.17,
      pastaAndBreadPasta: 1.5,
      pastaAndBreadBread: 1.1,
      gnocchi: substitutionReferences.gnocchi.carbohydrateFraction,
      cornmeal: substitutionReferences.cornmeal.carbohydrateFraction,
      riceCakes: substitutionReferences.riceCakes.carbohydrateFraction,
      crackers: substitutionReferences.crackers.carbohydrateFraction,
    };
    return Object.fromEntries(
      Object.entries(fractions).map(([key, fraction]) => {
        const substitution = key as SubstitutionKey;
        if (fraction === null) {
          if (
            !warnings.some(
              (w) =>
                w.code === "substitution-unavailable" &&
                w.substitution === substitution,
            )
          )
            warnings.push({ code: "substitution-unavailable", substitution });
          return [key, null];
        }
        return [
          key,
          quantity(
            roundSchemaGrams(carbs / fraction),
            schema.overrides.carbohydrates?.[slot]?.[substitution],
          ),
        ];
      }),
    ) as Record<SubstitutionKey, SchemaQuantity | null>;
  }
  const carbohydrates = {
    lunch: substitutions("lunch"),
    dinner: substitutions("dinner"),
  };
  const proteinGrams = meals.reduce(
    (sum, meal) =>
      sum +
      (meal.grams.protein.overridden
        ? meal.grams.protein.value
        : meal.macroKcal.protein / 4),
    0,
  );
  function proteinRatio(basis: "real" | keyof typeof weights, weight: number) {
    const value = proteinGrams / weight;
    if (value < 1.2 || value > 1.4)
      warnings.push({
        code: value < 1.2 ? "protein-low" : "protein-high",
        basis,
        value,
      });
    return value;
  }
  const real = proteinRatio("real", weightKg);
  const ideal = Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [
      key,
      {
        weightKg: value.weight,
        gramsPerKg: proteinRatio(key as keyof typeof weights, value.weight),
      },
    ]),
  ) as Extract<SchemaCalculation, { ok: true }>["protein"]["ideal"];
  if (
    !Number.isFinite(proteinGrams) ||
    meals.some(
      (meal) =>
        !Number.isFinite(meal.kcal) ||
        macroKeys.some((key) => !Number.isFinite(meal.grams[key].value)),
    )
  )
    return {
      ok: false,
      issues: [
        {
          field: "schema",
          message: "Controlla le quantità: il risultato è troppo grande.",
        },
      ],
    };
  return {
    ok: true,
    metabolism,
    fabbisogno,
    meals,
    carbohydrates,
    protein: { grams: proteinGrams, real, ideal },
    warnings,
  };
}
