import { useId } from "react";
import { ageAt, basalMetabolism, bmi, type MetabolismFormula } from "../calc";
import { formatIsoDate, formatNumber } from "../format";
import { type PatientForm, parsePatientForm } from "../patient";

const formulas: readonly {
  key: MetabolismFormula;
  name: string;
  band: string;
}[] = [
  { key: "harrisBenedict", name: "Harris-Benedict", band: "BMI ≤ 25" },
  { key: "mifflinStJeor", name: "Mifflin-St Jeor", band: "25 < BMI ≤ 30" },
  { key: "bernstein", name: "Bernstein", band: "BMI > 30" },
];

const requiredFields = [
  ["birthDate", "data di nascita"],
  ["sex", "sesso"],
  ["weightKg", "peso"],
  ["heightCm", "altezza"],
] as const;

const bmiFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });

/** Basal metabolism derived from the record being edited (saved or not), with
 * age at `today` (`YYYY-MM-DD`). Nothing is stored: it is recomputed on
 * every change. */
export function MetabolismPanel({
  form,
  today,
}: {
  form: PatientForm;
  today: string;
}) {
  const titleId = useId();
  return (
    <section className="metabolism" aria-labelledby={titleId}>
      <h4 id={titleId}>Metabolismo basale</h4>
      <p className="muted">
        Sono stime delle kcal consumate al giorno a riposo: non sono
        automaticamente le calorie da prescrivere nella dieta. La formula in uso
        è scelta dal BMI non arrotondato: fino a 25 incluso Harris-Benedict,
        oltre 25 fino a 30 incluso Mifflin-St Jeor, oltre 30 Bernstein.
      </p>
      <MetabolismResult form={form} today={today} />
    </section>
  );
}

function MetabolismResult({
  form,
  today,
}: {
  form: PatientForm;
  today: string;
}) {
  // The name plays no part in the calculation: a placeholder keeps the
  // validator from stopping on it, so only the data used below is checked.
  const parsed = parsePatientForm({ ...form, name: "-" }, today);
  if (!parsed.ok) {
    const problems = requiredFields.flatMap(([field]) => {
      const message = parsed.errors[field];
      return message ? [message] : [];
    });
    return (
      <p className="metabolism-problem">
        Per calcolarlo correggi: {problems.join(" ")}
      </p>
    );
  }

  const { birthDate, sex, weightKg, heightCm } = parsed.value;
  if (
    birthDate === null ||
    sex === null ||
    weightKg === null ||
    heightCm === null
  ) {
    const missing = requiredFields
      .filter(([field]) => parsed.value[field] === null)
      .map(([, label]) => label);
    return (
      <p className="metabolism-problem">
        Per calcolarlo completa: {missing.join(", ")}.
      </p>
    );
  }

  const age = ageAt(new Date(birthDate), new Date(today));
  const result = basalMetabolism({ sex, weightKg, heightCm, age });
  if (Object.values(result.formulas).some((kcal) => !(kcal > 0)))
    return (
      <p className="metabolism-problem">
        Con questi dati le formule non danno un valore plausibile: controlla
        data di nascita, peso e altezza.
      </p>
    );

  const chosen = formulas.find(({ key }) => key === result.formula);
  return (
    <>
      <p>
        Età al {formatIsoDate(today)}: {age} {age === 1 ? "anno" : "anni"}
      </p>
      <p>BMI: {bmiFormat.format(bmi(weightKg, heightCm))}</p>
      <p className="metabolism-chosen">
        Metabolismo basale usato: {chosen?.name}, {formatNumber(result.kcal)}{" "}
        kcal/giorno
      </p>
      <table>
        <caption className="visually-hidden">
          Confronto delle formule del metabolismo basale
        </caption>
        <thead>
          <tr>
            <th scope="col">Formula</th>
            <th scope="col">Fascia</th>
            <th scope="col" className="num">
              Risultato
            </th>
            <th scope="col">
              <span className="visually-hidden">Scelta</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {formulas.map(({ key, name, band }) => (
            <tr
              key={key}
              className={key === result.formula ? "chosen" : undefined}
            >
              <th scope="row">{name}</th>
              <td>{band}</td>
              <td className="num">
                {formatNumber(result.formulas[key])} kcal/giorno
              </td>
              <td>{key === result.formula ? "In uso" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
