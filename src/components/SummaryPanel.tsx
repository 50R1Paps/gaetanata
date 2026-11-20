import { macroCalories, type Nutrients } from "../calc";
import { formatNumber } from "../format";

function MacroTable({ nutrients }: { nutrients: Nutrients }) {
  const macros = macroCalories(nutrients);
  const rows = [
    [
      "Carboidrati",
      nutrients.carbohydratesG,
      macros.carbohydrates,
      macros.percentages.carbohydrates,
    ],
    ["Grassi", nutrients.fatG, macros.fat, macros.percentages.fat],
    [
      "Proteine",
      nutrients.proteinG,
      macros.protein,
      macros.percentages.protein,
    ],
  ] as const;

  return (
    <>
      <p className="kcal-total">
        <span className="value">{formatNumber(nutrients.caloriesKcal)}</span>{" "}
        kcal
      </p>
      <table className="macro-table">
        <thead>
          <tr>
            <th scope="col">Macronutriente</th>
            <th scope="col" className="num">
              g
            </th>
            <th scope="col" className="num">
              kcal
            </th>
            <th scope="col" className="num">
              %
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, grams, kcal, percentage]) => (
            <tr key={name}>
              <th scope="row">{name}</th>
              <td className="num">{formatNumber(grams)}</td>
              <td className="num">{formatNumber(kcal)}</td>
              <td className="num">{formatNumber(percentage)}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">Da macronutrienti</th>
            <td />
            <td className="num">{formatNumber(macros.total)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </>
  );
}

export function SummaryPanel({
  dayName,
  dayTotal,
  days,
  average,
  averageIncomplete,
  onToggleDay,
}: {
  dayName: string;
  dayTotal: Nutrients | null;
  days: readonly { name: string; kcal: number | null; included: boolean }[];
  average: Nutrients | null;
  averageIncomplete: boolean;
  onToggleDay: (index: number, included: boolean) => void;
}) {
  return (
    <aside className="panel summary" aria-label="Riepilogo">
      <section>
        <h2>Totale {dayName}</h2>
        {dayTotal ? (
          <MacroTable nutrients={dayTotal} />
        ) : (
          <p>Totale incompleto: correggi gli alimenti non riconosciuti.</p>
        )}
      </section>
      <section>
        <h2>Media settimanale</h2>
        <fieldset className="included-days">
          <legend>Giorni inclusi nella media</legend>
          {days.map((day, index) => (
            <label key={day.name}>
              <input
                type="checkbox"
                checked={day.included}
                onChange={(event) => onToggleDay(index, event.target.checked)}
              />
              <span>{day.name}</span>
              <span className="muted num">
                {day.kcal === null
                  ? "Incompleto"
                  : `${formatNumber(day.kcal)} kcal`}
              </span>
            </label>
          ))}
        </fieldset>
        {averageIncomplete ? (
          <p>
            Media incompleta: correggi gli alimenti non riconosciuti o escludi i
            giorni coinvolti.
          </p>
        ) : average ? (
          <MacroTable nutrients={average} />
        ) : (
          <p className="muted">Nessun giorno incluso nella media.</p>
        )}
      </section>
    </aside>
  );
}
