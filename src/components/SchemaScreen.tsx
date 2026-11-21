import { useId, useState } from "react";
import { mealSlots } from "../calc";
import { formatGrams, formatNumber, parseGrams } from "../format";
import type { Patient } from "../patient";
import {
  type DietSchema,
  type SchemaMacros,
  type SchemaMealCount,
  type SchemaOverrides,
  type SubstitutionKey,
  schemaMealSlots,
  substitutionKeys,
} from "../schema";
import {
  calculateSchema,
  type SchemaIdealBasis,
  type SchemaQuantity,
  substitutionReferences,
} from "../schemaCalc";
import { metabolismFormulas } from "./MetabolismPanel";

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
  today,
}: {
  patient: Patient | null;
  schema: DietSchema;
  setSchema: (update: (schema: DietSchema) => DietSchema) => void;
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
        </>
      )}
    </main>
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

/** A calculated quantity; a correction is highlighted, described and
 * revertible. Clearing the field does not revert: ↺ does. */
function QuantityInput({
  label,
  quantity,
  onChange,
  onRevert,
}: {
  label: string;
  quantity: SchemaQuantity;
  onChange: (grams: number) => void;
  onRevert: () => void;
}) {
  const noteId = useId();
  return (
    <span className={`quantity${quantity.overridden ? " overridden" : ""}`}>
      <NumberInput
        label={label}
        value={quantity.value}
        describedBy={quantity.overridden ? noteId : undefined}
        onChange={(grams) => grams !== null && onChange(grams)}
      />
      {quantity.overridden && (
        <>
          <span id={noteId} className="visually-hidden">
            Corretto a mano, calcolato {formatGrams(quantity.calculated)} g
          </span>
          <button
            type="button"
            className="revert"
            title="Ripristina il valore calcolato"
            aria-label={`Ripristina ${label}: ${formatGrams(quantity.calculated)} calcolati`}
            onClick={onRevert}
          >
            ↺ {formatGrams(quantity.calculated)}
          </button>
        </>
      )}
    </span>
  );
}
