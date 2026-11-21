import schema from "../src/data/food-schema.json" with { type: "json" };

const categories = new Map(
  schema.categories.map(({ id, label }) => [id, label]),
);
const measures = new Map(
  schema.householdMeasures.map(({ id, label, quantity, unit }) => [
    id,
    `${label}: ${quantity} ${unit}`,
  ]),
);

function cell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

const lines = [
  "# Revisione degli alimenti dello Schema",
  "",
  "Generato da `src/data/food-schema.json` con `npm run export:food-review --silent`. Non modificare questa copia: correggere i dati e rigenerare.",
  "",
  "Tutte le assegnazioni sono proposte dello sviluppatore, non ancora approvate dalla nutrizionista. INCERTO segnala un dubbio esplicito; Senza categoria esclude l’abbinamento automatico. Una categoria proposta non rende intercambiabili preparazioni o porzioni.",
  "",
  "Le misure sono convenzioni del Word, non pesi misurati della marca o della confezione. Nessuna misura indicata significa nessuna conversione casalinga assegnata. I ml non sono convertiti in grammi: non si presume una densità.",
  "",
  "## Misure casalinghe",
  "",
  "| Misura | Quantità |",
  "|---|---|",
  ...schema.householdMeasures.map(
    ({ label, quantity, unit }) => `| ${cell(label)} | ${quantity} ${unit} |`,
  ),
  "",
  "## Alimenti",
  "",
  "| Alimento | Categoria | Misure casalinghe | Revisione | Nota |",
  "|---|---|---|---|---|",
];

for (const [name, assignment] of Object.entries(schema.foods)) {
  const category =
    assignment.categoryId === null
      ? "Senza categoria"
      : categories.get(assignment.categoryId);
  if (!category) throw new Error(`Categoria sconosciuta: ${name}`);
  const household = assignment.measureIds.map((id) => {
    const measure = measures.get(id);
    if (!measure) throw new Error(`Misura sconosciuta: ${name}: ${id}`);
    return measure;
  });
  lines.push(
    `| ${[
      name,
      category,
      household.join("; ") || "—",
      assignment.uncertain ? "INCERTO" : "Proposta",
      assignment.note || "—",
    ]
      .map(cell)
      .join(" | ")} |`,
  );
}

process.stdout.write(`${lines.join("\n")}\n`);
