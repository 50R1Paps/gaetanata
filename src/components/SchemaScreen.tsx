import { useId, useState } from "react";
import { mealSlots } from "../calc";
import { formatGrams, formatNumber, parseGrams } from "../format";
import type { Patient } from "../patient";
import { type WeekPlan, weekDays } from "../plan";
import {
  type DietSchema,
  type SchemaDay,
  type SchemaMacros,
  type SchemaMealCount,
  type SchemaOverrides,
  type SchemaProteinChoice,
  type SchemaProteinSource,
  type SubstitutionKey,
  schemaMealSlots,
  schemaProteinSources,
  substitutionKeys,
} from "../schema";
import {
  calculateSchema,
  type SchemaCalculation,
  type SchemaIdealBasis,
  type SchemaProteinPortion,
  type SchemaQuantity,
  substitutionReferences,
} from "../schemaCalc";
import { metabolismFormulas } from "./MetabolismPanel";
import { SchemaPlanFill } from "./SchemaPlanFill";
import { SchemaWordPanel } from "./SchemaWordPanel";

const macroNames: Record<keyof SchemaMacros, string> = {
  carbohydrates: "Carboidrati",
  fat: "Lipidi",
  protein: "Proteine",
};
const macroKeys = Object.keys(macroNames) as (keyof SchemaMacros)[];
const substitutionNames: Record<SubstitutionKey, string> = {
  pasta: "Pasta",
  bread: "Pane",
  potatoes: "Patate",
  pastaAndBreadPasta: "Pasta e pane: pasta",
  pastaAndBreadBread: "Pasta e pane: pane",
  gnocchi: "Gnocchi di patate",
  cornmeal: "Polenta",
  riceCakes: "Gallette di riso",
  crackers: "Crackers",
};
const idealNames: Record<SchemaIdealBasis, string> = {
  bmi225: "Peso ideale BMI 22,5",
  bmi25: "Peso ideale BMI 25",
  lorenz: "Peso ideale Lorenz",
};
const ratioFormat = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percentFormat = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 2,
});
const proteinNames: Record<SchemaProteinSource, string> = {
  uova: "Uova",
  pesce: "Pesce",
  carne_bianca: "Carne bianca",
  carne_rossa: "Carne rossa",
  legumi_secchi: "Legumi secchi",
  legumi_scatola: "Legumi in scatola",
  formaggio_fresco: "Formaggio fresco",
  formaggio_stagionato: "Formaggio stagionato",
  affettati: "Affettati",
  pesce_scatola: "Tonno/pesce in scatola",
};
/** Recommended-frequency rows that group two sources, with each variant. */
const frequencyNames: Record<string, string> = {
  formaggi: "Formaggi",
  legumi: "Legumi",
};
const variantNames: Partial<Record<SchemaProteinSource, string>> = {
  formaggio_fresco: "fresco",
  formaggio_stagionato: "stagionato",
  legumi_secchi: "secchi",
  legumi_scatola: "in scatola",
};
const exceptionNames: Partial<Record<SchemaProteinSource, string>> = {
  uova: "3 uova (180 g)",
  pesce_scatola: "tonno 78 g",
};
const proteinMeals = [
  ["lunch", "pranzo"],
  ["dinner", "cena"],
] as const;
type ProteinMeal = (typeof proteinMeals)[number][0];
type Section = "proteinWeek" | "pizza" | "breakfast" | "snacks";

/** Sets or deletes (undefined) fields of an optional section; an emptied
 * section is dropped, so the saved JSON stays minimal like the overrides. */
function withSection<K extends Section>(
  schema: DietSchema,
  section: K,
  change: {
    [P in keyof NonNullable<DietSchema[K]>]?:
      | NonNullable<DietSchema[K]>[P]
      | undefined;
  },
): DietSchema {
  const entry: Record<string, unknown> = { ...schema[section], ...change };
  for (const [key, value] of Object.entries(entry))
    if (value === undefined) delete entry[key];
  const next = { ...schema };
  if (Object.keys(entry).length > 0) Object.assign(next, { [section]: entry });
  else delete next[section];
  return next;
}

/** No choice leaves the meal (and an emptied day) out of the saved week. */
function withProteinChoice(
  schema: DietSchema,
  day: SchemaDay,
  meal: ProteinMeal,
  choice: SchemaProteinChoice | undefined,
): DietSchema {
  const days = { ...schema.proteinWeek?.days };
  const entry = { ...days[day] };
  if (choice) entry[meal] = choice;
  else delete entry[meal];
  if (Object.keys(entry).length > 0) days[day] = entry;
  else delete days[day];
  return withSection(schema, "proteinWeek", {
    days: Object.keys(days).length > 0 ? days : undefined,
  });
}

/** Removing the last key of a group drops the group: deleting an override
 * restores the calculation, and the saved JSON stays minimal. */
function withOverride(
  overrides: SchemaOverrides,
  group: keyof SchemaOverrides,
  slot: string,
  key: string,
  grams: number | undefined,
): SchemaOverrides {
  const groups: Record<string, Record<string, number>> = {
    ...overrides[group],
  };
  const entry = { ...groups[slot] };
  if (grams === undefined) delete entry[key];
  else entry[key] = grams;
  if (Object.keys(entry).length > 0) groups[slot] = entry;
  else delete groups[slot];
  const next: SchemaOverrides = { ...overrides };
  if (Object.keys(groups).length > 0) Object.assign(next, { [group]: groups });
  else delete next[group];
  return next;
}

/** The Schema of the selected patient: settings on the left, calculated
 * quantities (each correctable by hand) on the right. Only `schema`, the
 * inputs and corrections, is state; every number shown is recalculated. */
export function SchemaScreen({
  patient,
  schema,
  setSchema,
  schemaDirty,
  plan,
  setPlan,
  today,
}: {
  patient: Patient | null;
  schema: DietSchema;
  setSchema: (update: (schema: DietSchema) => DietSchema) => void;
  /** Whether the Schema differs from the saved one, used for the Word. */
  schemaDirty: boolean;
  /** The free editor's plan, which the Schema can fill. */
  plan: WeekPlan;
  setPlan: (plan: WeekPlan) => void;
  today: string;
}) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  if (!patient)
    return (
      <main className="schema-screen" aria-labelledby={titleId}>
        <section className="panel">
          <h2 id={titleId}>Schema</h2>
          <p>
            Seleziona un paziente con il pulsante «Paziente» per compilare lo
            schema.
          </p>
        </section>
      </main>
    );

  const result = calculateSchema(patient, schema, today);
  const kcalOnly =
    !result.ok && result.issues.every((issue) => issue.field === "kcal");
  // Metabolism and fabbisogno do not depend on the diet kcal: with only the
  // kcal missing, a placeholder lets them be shown to choose the kcal.
  const basis = kcalOnly
    ? calculateSchema(patient, { ...schema, kcal: 1 }, today)
    : result;
  const macroSum = macroKeys.reduce(
    (sum, key) => sum + schema.macroPercent[key],
    0,
  );
  const splitInvalid = Math.abs(macroSum - 100) > 1e-8;
  const update = (change: Partial<DietSchema>) =>
    setSchema((current) => ({ ...current, ...change }));
  const setOverride = (
    group: keyof SchemaOverrides,
    slot: string,
    key: string,
    grams: number | undefined,
  ) =>
    setSchema((current) => ({
      ...current,
      overrides: withOverride(current.overrides, group, slot, key, grams),
    }));

  return (
    <main className="schema-screen" aria-labelledby={titleId}>
      <section className="panel schema-settings">
        <h2 id={titleId}>Schema</h2>
        {basis.ok && (
          <div className="schema-energy">
            <p>
              Metabolismo basale (
              {
                metabolismFormulas.find(
                  ({ key }) => key === basis.metabolism.formula,
                )?.name
              }
              ):{" "}
              <strong>{formatNumber(basis.metabolism.kcal)} kcal/giorno</strong>
            </p>
            <p>
              Fabbisogno (metabolismo × LAF):{" "}
              <strong>{formatNumber(basis.fabbisogno)} kcal/giorno</strong>
            </p>
          </div>
        )}
        <div className="schema-fields">
          <div className="schema-field">
            <label htmlFor={`${baseId}-laf`}>LAF</label>
            <NumberInput
              id={`${baseId}-laf`}
              value={schema.laf}
              positive
              onChange={(laf) => laf !== null && update({ laf })}
            />
          </div>
          <div className="schema-field">
            <label htmlFor={`${baseId}-kcal`}>Kcal dieta</label>
            <NumberInput
              id={`${baseId}-kcal`}
              value={schema.kcal}
              positive
              allowEmpty
              onChange={(kcal) => update({ kcal })}
            />
          </div>
          <div className="schema-field">
            <label htmlFor={`${baseId}-meals`}>Numero di pasti</label>
            <select
              id={`${baseId}-meals`}
              value={schema.mealCount}
              onChange={(event) =>
                update({
                  mealCount: Number(event.target.value) as SchemaMealCount,
                })
              }
            >
              {[3, 4, 5, 6].map((count) => (
                <option key={count} value={count}>
                  {count}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="schema-fields">
          <legend>Ripartizione delle kcal</legend>
          {macroKeys.map((key) => (
            <div key={key} className="schema-field">
              <label htmlFor={`${baseId}-${key}`}>{macroNames[key]} (%)</label>
              <NumberInput
                id={`${baseId}-${key}`}
                value={schema.macroPercent[key]}
                invalid={splitInvalid}
                onChange={(percent) =>
                  percent !== null &&
                  setSchema((current) => ({
                    ...current,
                    macroPercent: { ...current.macroPercent, [key]: percent },
                  }))
                }
              />
            </div>
          ))}
        </fieldset>
        {splitInvalid && (
          <p className="schema-problem">
            La ripartizione deve sommare a 100 % (ora{" "}
            {percentFormat.format(macroSum)} %).
          </p>
        )}
        {!result.ok && (
          <div className="schema-problem">
            {result.issues.some((issue) => issue.field !== "kcal") && (
              <p>
                Per calcolare lo schema completa o correggi la scheda paziente
                (pulsante «Paziente») o le impostazioni:
              </p>
            )}
            <ul>
              {result.issues.map((issue) => (
                <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <SchemaWordPanel
        key={patient.id}
        patientId={patient.id}
        schemaDirty={schemaDirty}
      />
      <SchemaPlanFill
        key={`fill-${patient.id}`}
        result={result}
        plan={plan}
        setPlan={setPlan}
        proteinNames={proteinNames}
      />

      {result.ok && (
        <>
          <section className="panel schema-meals">
            <h2>Pasti</h2>
            <p className="hint">
              Grammi arrotondati ai 5 g. Le correzioni a mano sono evidenziate
              in giallo; il pulsante ↺ mostra il valore calcolato e lo
              ripristina.
            </p>
            <div className="table-scroll">
              <table className="schema-table">
                <caption className="visually-hidden">
                  Ripartizione per pasto
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Pasto</th>
                    <th scope="col" className="num">
                      %
                    </th>
                    <th scope="col" className="num">
                      kcal
                    </th>
                    {macroKeys.map((key) => (
                      <th key={key} scope="col" className="num">
                        {macroNames[key]} (g)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.meals.map((meal) => {
                    const name =
                      mealSlots[schemaMealSlots.indexOf(meal.slot)] ?? "";
                    return (
                      <tr key={meal.slot}>
                        <th scope="row">{name}</th>
                        <td className="num">{meal.percent} %</td>
                        <td className="num">{formatNumber(meal.kcal)}</td>
                        {macroKeys.map((key) => (
                          <td key={key} className="num">
                            <QuantityInput
                              label={`${macroNames[key]} ${name} (g)`}
                              quantity={meal.grams[key]}
                              onChange={(grams) =>
                                setOverride("meals", meal.slot, key, grams)
                              }
                              onRevert={() =>
                                setOverride("meals", meal.slot, key, undefined)
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Totale</th>
                    <td className="num">100 %</td>
                    <td className="num">{formatNumber(schema.kcal ?? 0)}</td>
                    {macroKeys.map((key) => (
                      <td key={key} className="num">
                        {formatGrams(
                          result.meals.reduce(
                            (sum, meal) => sum + meal.grams[key].value,
                            0,
                          ),
                        )}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>

          <section className="panel schema-carbs">
            <h2>Carboidrati di pranzo e cena</h2>
            <p className="schema-highlight">
              Pranzo: pasta{" "}
              <strong>
                {formatGrams(result.carbohydrates.lunch.pasta?.value ?? 0)} g
              </strong>{" "}
              · Cena: pane{" "}
              <strong>
                {formatGrams(result.carbohydrates.dinner.bread?.value ?? 0)} g
              </strong>
            </p>
            <div className="table-scroll">
              <table className="schema-table">
                <caption className="visually-hidden">Sostituzioni</caption>
                <thead>
                  <tr>
                    <th scope="col">Alimento</th>
                    <th scope="col" className="num">
                      Pranzo (g)
                    </th>
                    <th scope="col" className="num">
                      Cena (g)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {substitutionKeys.map((key) => (
                    <tr key={key}>
                      <th scope="row">{substitutionNames[key]}</th>
                      {(["lunch", "dinner"] as const).map((slot) => {
                        const quantity = result.carbohydrates[slot][key];
                        return (
                          <td key={slot} className="num">
                            {quantity ? (
                              <QuantityInput
                                label={`${substitutionNames[key]} a ${slot === "lunch" ? "pranzo" : "cena"} (g)`}
                                quantity={quantity}
                                onChange={(grams) =>
                                  setOverride("carbohydrates", slot, key, grams)
                                }
                                onRevert={() =>
                                  setOverride(
                                    "carbohydrates",
                                    slot,
                                    key,
                                    undefined,
                                  )
                                }
                              />
                            ) : (
                              <span className="muted">Non disponibile</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.warnings.map((warning) =>
              warning.code === "substitution-unavailable" ? (
                <p key={warning.substitution} className="schema-warning">
                  {substitutionNames[warning.substitution]}:{" "}
                  {warning.substitution in substitutionReferences
                    ? `«${substitutionReferences[warning.substitution as keyof typeof substitutionReferences].food}» non è nella tabella degli alimenti`
                    : "non disponibile"}
                  , quantità non calcolata.
                </p>
              ) : null,
            )}
          </section>

          <section className="panel schema-protein">
            <h2>Proteine</h2>
            <p>
              Totale: <strong>{formatNumber(result.protein.grams)} g</strong> al
              giorno. Intervallo consigliato 1,2–1,4 g/kg.
            </p>
            <table className="schema-table">
              <caption className="visually-hidden">Proteine per kg</caption>
              <thead>
                <tr>
                  <th scope="col">Peso</th>
                  <th scope="col" className="num">
                    kg
                  </th>
                  <th scope="col" className="num">
                    g/kg
                  </th>
                  <th scope="col">Esito</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    key: "real",
                    name: "Peso reale",
                    weightKg: patient.weightKg ?? 0,
                    gramsPerKg: result.protein.real,
                  },
                  ...(Object.keys(idealNames) as SchemaIdealBasis[]).map(
                    (key) => ({
                      key,
                      name: idealNames[key],
                      ...result.protein.ideal[key],
                    }),
                  ),
                ].map((row) => {
                  const warning = result.warnings.find(
                    (warning) =>
                      warning.code !== "substitution-unavailable" &&
                      warning.basis === row.key,
                  );
                  return (
                    <tr key={row.key} className={warning ? "warning" : ""}>
                      <th scope="row">{row.name}</th>
                      <td className="num">{formatNumber(row.weightKg)}</td>
                      <td className="num">
                        {ratioFormat.format(row.gramsPerKg)}
                      </td>
                      <td>
                        {warning?.code === "protein-low"
                          ? "Sotto 1,2"
                          : warning?.code === "protein-high"
                            ? "Sopra 1,4"
                            : "Nell'intervallo"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <IntakePanel result={result} setSchema={setSchema} />
          <ProteinWeekPanel
            schema={schema}
            result={result}
            setSchema={setSchema}
          />
        </>
      )}
    </main>
  );
}

type Calculated = Extract<SchemaCalculation, { ok: true }>;
type SetSchema = (update: (schema: DietSchema) => DietSchema) => void;

/** Colazione and spuntini: manual quantities starting from the proposed
 * values, independent of the kcal and of the number of meals. */
function IntakePanel({
  result,
  setSchema,
}: {
  result: Calculated;
  setSchema: SetSchema;
}) {
  const baseId = useId();
  const { breakfast, snacks } = result;
  return (
    <section
      className="panel schema-intake"
      aria-labelledby={`${baseId}-title`}
    >
      <h2 id={`${baseId}-title`}>Colazione e spuntini</h2>
      <fieldset className="schema-fields">
        <legend>Colazione</legend>
        <div className="schema-choice">
          {(["latte", "yogurt"] as const).map((choice) => (
            <label key={choice}>
              <input
                type="radio"
                name={`${baseId}-breakfast`}
                checked={breakfast.choice === choice}
                onChange={() =>
                  // The other food's quantity does not carry over.
                  setSchema((current) =>
                    withSection(current, "breakfast", {
                      choice,
                      quantity: undefined,
                    }),
                  )
                }
              />
              {choice === "latte" ? "Latte" : "Yogurt"}
            </label>
          ))}
        </div>
        <LabeledQuantity
          label={
            breakfast.choice === "latte"
              ? "Latte a colazione (ml)"
              : "Yogurt a colazione (g)"
          }
          unit={breakfast.unit}
          quantity={breakfast.quantity}
          onChange={(quantity) =>
            setSchema((current) =>
              withSection(current, "breakfast", { quantity }),
            )
          }
        />
      </fieldset>
      <fieldset className="schema-fields">
        <legend>Spuntini</legend>
        <LabeledQuantity
          label="Frutta secca spuntino (g)"
          quantity={snacks.nuts}
          onChange={(nutsGrams) =>
            setSchema((current) =>
              withSection(current, "snacks", { nutsGrams }),
            )
          }
        />
        <LabeledQuantity
          label="Yogurt spuntino (g)"
          quantity={snacks.yogurt}
          onChange={(yogurtGrams) =>
            setSchema((current) =>
              withSection(current, "snacks", { yogurtGrams }),
            )
          }
        />
      </fieldset>
    </section>
  );
}

/** Seven days × lunch/dinner protein choices (a per-day list when narrow),
 * their weekly counts, and the pizza day: an extra eighth day, not a
 * weekday, which does not count as a protein source. */
function ProteinWeekPanel({
  schema,
  result,
  setSchema,
}: {
  schema: DietSchema;
  result: Calculated;
  setSchema: SetSchema;
}) {
  const baseId = useId();
  const { proteinWeek, pizza } = result;
  return (
    <section className="panel schema-week" aria-labelledby={`${baseId}-title`}>
      <h2 id={`${baseId}-title`}>Fonti proteiche</h2>
      <p className="hint">
        Scegli la fonte di ogni pranzo e cena («Nessuna» lascia il pasto vuoto).
        Ogni fonte propone la sua quantità, correggibile; carne bianca (×1,3) e
        pesce (×1,5) si ricalcolano dalla base della carne rossa.
      </p>
      <div className="schema-fields">
        <div className="schema-field">
          <label htmlFor={`${baseId}-red-meat`}>
            Carne rossa, quantità base (g)
          </label>
          <NumberInput
            id={`${baseId}-red-meat`}
            value={schema.proteinWeek?.redMeatGrams ?? null}
            allowEmpty
            onChange={(grams) =>
              setSchema((current) =>
                withSection(current, "proteinWeek", {
                  redMeatGrams: grams ?? undefined,
                }),
              )
            }
          />
        </div>
      </div>
      <div className="schema-week-body">
        <div className="protein-week">
          <div className="protein-day protein-week-head" aria-hidden="true">
            <span>Giorno</span>
            <span>Pranzo</span>
            <span>Cena</span>
          </div>
          {proteinWeek.days.map((entry, index) => {
            const name = weekDays[index] ?? entry.day;
            return (
              <fieldset key={entry.day} className="protein-day">
                <legend className="protein-day-name">{name}</legend>
                {proteinMeals.map(([meal, mealName]) => (
                  <ProteinMealInput
                    key={meal}
                    label={`${name} ${mealName}`}
                    mealName={mealName}
                    choice={schema.proteinWeek?.days?.[entry.day]?.[meal]}
                    portion={entry[meal]}
                    onChange={(choice) =>
                      setSchema((current) =>
                        withProteinChoice(current, entry.day, meal, choice),
                      )
                    }
                  />
                ))}
              </fieldset>
            );
          })}
        </div>
        <div className="schema-frequencies">
          <h3 id={`${baseId}-counts`}>Frequenze settimanali</h3>
          <table className="schema-table" aria-labelledby={`${baseId}-counts`}>
            <thead>
              <tr>
                <th scope="col">Fonte</th>
                <th scope="col" className="num">
                  Volte
                </th>
                <th scope="col" className="num">
                  Consigliate
                </th>
                <th scope="col">Esito</th>
              </tr>
            </thead>
            <tbody>
              {proteinWeek.frequencies.map((frequency) => (
                <tr
                  key={frequency.key}
                  className={frequency.outOfRange ? "warning" : ""}
                >
                  <th scope="row">
                    {frequencyNames[frequency.key] ??
                      proteinNames[frequency.key as SchemaProteinSource] ??
                      frequency.key}
                    {frequency.sources.length > 1 && (
                      <span className="muted schema-variants">
                        {frequency.sources
                          .map(
                            (source) =>
                              `${variantNames[source] ?? proteinNames[source]} ${proteinWeek.counts[source]}`,
                          )
                          .join(" · ")}
                      </span>
                    )}
                  </th>
                  <td className="num">{frequency.count}</td>
                  <td className="num">
                    {frequency.min}–{frequency.max}
                  </td>
                  <td>
                    {frequency.count < frequency.min
                      ? "Sotto"
                      : frequency.count > frequency.max
                        ? "Sopra"
                        : "Nell'intervallo"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <section className="schema-pizza" aria-labelledby={`${baseId}-pizza`}>
        <h3 id={`${baseId}-pizza`}>Giorno pizza (in più)</h3>
        <p className="hint">
          Un giorno in più, intercambiabile con uno della settimana: non è uno
          dei sette giorni e non conta nelle fonti proteiche.
        </p>
        <div className="schema-fields">
          <LabeledQuantity
            label="Pane giorno pizza (g)"
            quantity={pizza.bread}
            onChange={(breadGrams) =>
              setSchema((current) =>
                withSection(current, "pizza", { breadGrams }),
              )
            }
          />
          <LabeledQuantity
            label="Olio giorno pizza (ml)"
            unit="ml"
            quantity={pizza.oil}
            onChange={(oilMl) =>
              setSchema((current) => withSection(current, "pizza", { oilMl }))
            }
          />
        </div>
      </section>
    </section>
  );
}

/** One lunch or dinner: source, its quantity (proposed, correctable) and,
 * for eggs and canned fish, the high-protein exception. A new source starts
 * again from its own proposal. */
function ProteinMealInput({
  label,
  mealName,
  choice,
  portion,
  onChange,
}: {
  label: string;
  mealName: string;
  choice: SchemaProteinChoice | undefined;
  portion: SchemaProteinPortion | null;
  onChange: (choice: SchemaProteinChoice | undefined) => void;
}) {
  const hintId = useId();
  const exception = choice && exceptionNames[choice.source];
  const withoutKey = (key: "grams" | "exception") => {
    const next = { ...choice } as SchemaProteinChoice;
    delete next[key];
    return next;
  };
  return (
    <div className="protein-meal">
      <span className="protein-meal-name" aria-hidden="true">
        {mealName}
      </span>
      <select
        aria-label={`Fonte ${label}`}
        value={choice?.source ?? ""}
        onChange={(event) => {
          const source = event.target.value as SchemaProteinSource | "";
          onChange(source ? { source } : undefined);
        }}
      >
        <option value="">Nessuna</option>
        {schemaProteinSources.map((source) => (
          <option key={source} value={source}>
            {proteinNames[source]}
          </option>
        ))}
      </select>
      {choice && portion && (
        <>
          <QuantityInput
            label={`Quantità ${label} (g)`}
            quantity={
              portion.quantity ?? {
                calculated: null,
                value: null,
                overridden: false,
              }
            }
            describedBy={portion.quantity ? undefined : hintId}
            onChange={(grams) => onChange({ ...choice, grams })}
            onRevert={() => onChange(withoutKey("grams"))}
          />
          {!portion.quantity && (
            <span id={hintId} className="muted">
              Inserisci la base carne rossa
            </span>
          )}
        </>
      )}
      {choice && exception && (
        <label className="protein-exception">
          <input
            type="checkbox"
            aria-label={`${label}: ${exception}`}
            checked={choice.exception ?? false}
            onChange={(event) =>
              onChange(
                event.target.checked
                  ? { ...choice, exception: true }
                  : withoutKey("exception"),
              )
            }
          />
          {exception}
        </label>
      )}
    </div>
  );
}

/** A quantity with a visible label, for fields outside the tables; clearing
 * the correction (↺) passes undefined. */
function LabeledQuantity({
  label,
  unit = "g",
  quantity,
  onChange,
}: {
  label: string;
  unit?: string;
  quantity: SchemaQuantity;
  onChange: (value: number | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="schema-field">
      <label htmlFor={id}>{label}</label>
      <QuantityInput
        id={id}
        label={label}
        unit={unit}
        quantity={quantity}
        onChange={onChange}
        onRevert={() => onChange(undefined)}
      />
    </div>
  );
}

/** Keeps the typed text while editing, like GramsInput: only valid numbers
 * reach the schema, an empty field means null only when `allowEmpty`. */
function NumberInput({
  id,
  label,
  value,
  onChange,
  positive = false,
  allowEmpty = false,
  invalid = false,
  describedBy,
}: {
  id?: string;
  label?: string;
  value: number | null;
  onChange: (value: number | null) => void;
  positive?: boolean;
  allowEmpty?: boolean;
  invalid?: boolean;
  describedBy?: string | undefined;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (text: string) => {
    if (text.trim() === "") return allowEmpty ? { value: null } : null;
    const parsed = parseGrams(text);
    return parsed === null || (positive && parsed === 0)
      ? null
      : { value: parsed };
  };
  return (
    <input
      id={id}
      className="grams"
      type="text"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={invalid || (draft !== null && parse(draft) === null)}
      aria-describedby={describedBy}
      value={draft ?? (value === null ? "" : formatGrams(value))}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const text = event.target.value;
        setDraft(text);
        const parsed = parse(text);
        if (parsed) onChange(parsed.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}

/** A calculated (or proposed) quantity; a correction is highlighted,
 * described and revertible. Clearing the field does not revert: ↺ does.
 * Without a calculation (null) the field starts empty. With `id` the caller
 * renders a visible <label>; otherwise `label` names the field. */
function QuantityInput({
  id,
  label,
  unit = "g",
  quantity,
  describedBy,
  onChange,
  onRevert,
}: {
  id?: string;
  label: string;
  unit?: string;
  quantity: {
    calculated: number | null;
    value: number | null;
    overridden: boolean;
  };
  describedBy?: string | undefined;
  onChange: (grams: number) => void;
  onRevert: () => void;
}) {
  const noteId = useId();
  const calculated =
    quantity.calculated === null ? null : formatGrams(quantity.calculated);
  return (
    <span className={`quantity${quantity.overridden ? " overridden" : ""}`}>
      <NumberInput
        {...(id ? { id } : { label })}
        value={quantity.value}
        describedBy={
          [quantity.overridden && noteId, describedBy]
            .filter(Boolean)
            .join(" ") || undefined
        }
        onChange={(grams) => grams !== null && onChange(grams)}
      />
      {quantity.overridden && (
        <>
          <span id={noteId} className="visually-hidden">
            {calculated === null
              ? "Corretto a mano, nessun valore calcolato"
              : `Corretto a mano, calcolato ${calculated} ${unit}`}
          </span>
          <button
            type="button"
            className="revert"
            title="Ripristina il valore calcolato"
            aria-label={`Ripristina ${label}: ${calculated === null ? "nessun valore calcolato" : `${calculated} calcolati`}`}
            onClick={onRevert}
          >
            ↺ {calculated ?? "—"}
          </button>
        </>
      )}
    </span>
  );
}
