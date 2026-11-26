// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { ageAt, basalMetabolism } from "../calc";
import { formatNumber } from "../format";
import { localToday } from "../patient";
import { emptyWeekPlan } from "../plan";
import { type DietSchema, emptySchema } from "../schema";
import {
  patients as kitPatients,
  openSchema,
  setup,
  stubDialogs,
} from "./schemaTestKit";

// Fake, anonymous: BMI about 33, so the protein reference is BMI 25.
const patients = [
  ...kitPatients,
  {
    id: 3,
    name: "Prova Tre",
    birthDate: "1980-03-15",
    sex: "female" as const,
    weightKg: 90,
    heightCm: 165,
  },
];

// The real API is tested over HTTP in server/schemas.test.ts; here an
// in-memory stand-in answers the same routes.
let schemas: Map<number, DietSchema>;
let offline: boolean;

beforeEach(() => {
  schemas = new Map();
  offline = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (offline) throw new TypeError("fetch failed");
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path === "/api/patients") return Response.json({ patients });
    // The Word panel is tested in SchemaWordPanel.test.tsx.
    if (path === "/api/template") return Response.json({ available: false });
    const [, , , id, document] = path.split("/");
    if (document === "plan") return Response.json(emptyWeekPlan());
    if (document === "documents") return Response.json({ documents: [] });
    if (init.method === "PUT")
      schemas.set(Number(id), JSON.parse(String(init.body)));
    return Response.json(schemas.get(Number(id)) ?? emptySchema());
  });
  stubDialogs();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Label queries walk the whole subtree: scoping them to the section under
 * test keeps the long Schema tests within the 5 s budget. */
type Area = Pick<typeof screen, "getByLabelText">;

/** Replaces the field's text in one input event, as pasting would: the
 * fields keep the typed text, so a keystroke at a time adds nothing. */
async function type(
  user: UserEvent,
  label: string,
  text: string,
  area: Area = screen,
) {
  const input = area.getByLabelText(label);
  await user.clear(input);
  await user.paste(text);
}

const value = (label: string, area: Area = screen) =>
  (area.getByLabelText(label) as HTMLInputElement).value;

/** A titled section of the Schema, found by its heading text: cheaper than a
 * role query over the whole screen, which computes every element's role. */
function section(title: string) {
  const element = screen
    .getByText(title, { selector: "h2, h3" })
    .closest("section");
  if (!element) throw new Error(`No section «${title}»`);
  return within(element);
}

it("says what to complete in the record instead of showing numbers", async () => {
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Due");

  const screenArea = screen.getByRole("main", { name: "Schema" });
  expect(within(screenArea).getByText("Completa peso.")).toBeTruthy();
  expect(within(screenArea).getByText("Completa altezza.")).toBeTruthy();
  expect(within(screenArea).queryByRole("table")).toBeNull();
  expect(within(screenArea).queryByText(/kcal\/giorno/)).toBeNull();
});

it("starts from metabolism and fabbisogno, then splits the diet kcal", async () => {
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  const basal = basalMetabolism({
    sex: "female",
    weightKg: 60,
    heightCm: 165,
    age: ageAt(new Date("1990-05-10"), new Date(localToday())),
  }).kcal;
  const main = within(screen.getByRole("main", { name: "Schema" }));
  expect(main.getByText(/Metabolismo basale/).textContent).toContain(
    `${formatNumber(basal)} kcal/giorno`,
  );
  expect(main.getByText(/Fabbisogno/).textContent).toContain(
    `${formatNumber(basal * 1.4)} kcal/giorno`,
  );
  expect(screen.getByText("Inserisci le kcal dieta.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();

  await type(user, "LAF", "1,6");
  expect(main.getByText(/Fabbisogno/).textContent).toContain(
    `${formatNumber(basal * 1.6)} kcal/giorno`,
  );

  await type(user, "Kcal dieta", "1800");
  const meals = screen.getByRole("table", { name: "Ripartizione per pasto" });
  expect(within(meals).getAllByRole("row")).toHaveLength(7); // head, 5, total
  const lunch = within(meals).getByRole("row", { name: /^Pranzo/ });
  // Each macro shows the kcal of its grams: 80 g × 4, 25 g × 9, 35 g × 4.
  expect(
    within(lunch)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["40 %", "720", "320 kcal", "225 kcal", "140 kcal"]);
  const total = within(meals).getByRole("row", { name: /^Totale/ });
  for (const kcal of ["900 kcal", "585 kcal", "360 kcal"])
    expect(within(total).getByText(kcal)).toBeTruthy();
  expect(value("Carboidrati Pranzo (g)")).toBe("80");
  expect(value("Lipidi Pranzo (g)")).toBe("25");
  expect(value("Proteine Pranzo (g)")).toBe("35");
  expect(value("Carboidrati Cena (g)")).toBe("80");
  expect(value("Pasta a pranzo (g)")).toBe("105");
  expect(value("Pane a cena (g)")).toBe("145");
  expect(value("Patate a pranzo (g)")).toBe("470");
  const carbs = screen.getByRole("table", { name: "Sostituzioni" });
  expect(
    within(within(carbs).getByRole("row", { name: /^Polenta/ })).getAllByText(
      "Non disponibile",
    ),
  ).toHaveLength(2);
  expect(screen.getByText(/Farina di mais.*non è nella tabella/)).toBeTruthy();

  // Normal weight: the g/kg is on the real weight only.
  const protein = screen.getByRole("table", { name: "Proteine per kg" });
  expect(within(protein).getAllByRole("row")).toHaveLength(2); // head + 1
  const real = within(protein).getByRole("row", { name: /^Peso reale/ });
  expect(
    within(real)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["60", "1,50", "Sopra 1,4"]);
  expect(real.className).toBe("warning");
});

it("checks the protein of an obese patient on the BMI 25 weight", async () => {
  schemas.set(3, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Tre");

  // 90 g over 25 × 1,65² = 68,06 kg: 1,32 g/kg, inside 1,2–1,4, while the
  // real 90 kg would give 1,00.
  const protein = screen.getByRole("table", { name: "Proteine per kg" });
  expect(within(protein).getAllByRole("row")).toHaveLength(2);
  expect(
    within(protein).queryByRole("row", { name: /^Peso reale/ }),
  ).toBeNull();
  const reference = within(protein).getByRole("row", {
    name: /^Peso ideale BMI 25/,
  });
  expect(
    within(reference)
      .getAllByRole("cell")
      .map((cell) => cell.textContent),
  ).toEqual(["68,1", "1,32", "Nell'intervallo"]);
  expect(reference.className).toBe("");
});

it("splits by the number of meals and requires macros summing to 100 %", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  await user.selectOptions(screen.getByLabelText("Numero di pasti"), "3");
  expect(
    within(
      screen.getByRole("table", { name: "Ripartizione per pasto" }),
    ).getAllByRole("row"),
  ).toHaveLength(5);

  await type(user, "Carboidrati (%)", "55");
  expect(
    screen.getByText("La ripartizione deve sommare a 100 % (ora 105 %)."),
  ).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  await type(user, "Lipidi (%)", "25");
  expect(screen.getByRole("table", { name: "Ripartizione per pasto" }));
});

it("keeps manual corrections visible and lets them be undone", async () => {
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  await type(user, "Kcal dieta", "1800");

  await type(user, "Carboidrati Pranzo (g)", "60");
  await user.tab();
  const lunchCarbs = screen.getByLabelText("Carboidrati Pranzo (g)");
  expect(lunchCarbs.getAttribute("aria-describedby")).toBeTruthy();
  expect(
    document.getElementById(lunchCarbs.getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Corretto a mano, calcolato 80 g");
  // The kcal follow the corrected grams, in the meal and in the total.
  const meals = within(
    screen.getByRole("table", { name: "Ripartizione per pasto" }),
  );
  expect(
    within(meals.getByRole("row", { name: /^Pranzo/ })).getByText("240 kcal"),
  ).toBeTruthy();
  expect(
    within(meals.getByRole("row", { name: /^Totale/ })).getByText("820 kcal"),
  ).toBeTruthy();
  expect(value("Pasta a pranzo (g)")).toBe("80");
  expect(value("Pane a pranzo (g)")).toBe("110");
  expect(value("Patate a pranzo (g)")).toBe("355");
  expect(value("Pasta a cena (g)")).toBe("105");

  await type(user, "Pane a cena (g)", "150");
  expect(
    screen.getByRole("button", {
      name: "Ripristina Pane a cena (g): 145 calcolati",
    }),
  ).toBeTruthy();

  await user.click(
    screen.getByRole("button", {
      name: "Ripristina Carboidrati Pranzo (g): 80 calcolati",
    }),
  );
  expect(value("Carboidrati Pranzo (g)")).toBe("80");
  expect(
    screen
      .getByLabelText("Carboidrati Pranzo (g)")
      .hasAttribute("aria-describedby"),
  ).toBe(false);
  expect(value("Pasta a pranzo (g)")).toBe("105");
  expect(value("Pane a cena (g)")).toBe("150");
});

it("saves and warns about unsaved changes", async () => {
  // Sections loaded with the schema (protein week, pizza) survive a save.
  const sections = {
    proteinWeek: {
      redMeatGrams: 100,
      days: { lunedi: { lunch: { source: "pesce" } } },
    },
    pizza: { breadGrams: 60 },
  } satisfies Partial<DietSchema>;
  schemas.set(1, { ...emptySchema(), ...sections });
  const user = setup();
  const status = () =>
    screen.getByRole("status", { name: "Schema" }).textContent;
  render(<App />);
  await openSchema(user, "Prova Uno");
  await type(user, "Kcal dieta", "1800");
  await type(user, "Proteine Cena (g)", "40");
  expect(status()).toBe("Schema modificato, non salvato.");

  offline = true;
  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findAllByText(/Salvataggio schema non riuscito/);
  expect(status()).toBe("Schema modificato, non salvato.");
  offline = false;
  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(schemas.get(1)).toEqual({
    ...emptySchema(),
    ...sections,
    kcal: 1800,
    overrides: { meals: { dinner: { protein: 40 } } },
  });

  await type(user, "Carboidrati (%)", "60");
  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  expect(
    await screen.findAllByText(
      /Salvataggio schema non riuscito: controlla le impostazioni/,
    ),
  ).not.toHaveLength(0);
  expect(schemas.get(1)?.macroPercent.carbohydrates).toBe(50);

  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  await user.click(screen.getByRole("button", { name: /^Prova Due/ }));
  expect(
    screen.getByText(
      "Lo schema contiene modifiche non salvate. Salvarle o scartarle prima di cambiare paziente?",
    ),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Scarta e cambia" }));
  await screen.findByRole("button", { name: "Paziente: Prova Due" });
});

it("reopens a saved schema with its corrections", async () => {
  schemas.set(1, {
    ...emptySchema(),
    kcal: 1800,
    overrides: { meals: { dinner: { protein: 40 } } },
  });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  expect(value("Kcal dieta")).toBe("1800");
  expect(value("Carboidrati (%)")).toBe("50");
  expect(value("Proteine Cena (g)")).toBe("40");
  expect(screen.getByRole("status", { name: "Schema" }).textContent).toBe(
    "Schema caricato.",
  );
});

const source = (meal: string, area: Area) =>
  area.getByLabelText(`Fonte ${meal}`);
const grams = (meal: string, area: Area) => value(`Quantità ${meal}`, area);

it("chooses lunch and dinner protein sources with their starting quantities", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  const week = section("Fonti proteiche");
  for (const day of ["Lunedì", "Domenica"])
    expect(week.getByRole("group", { name: day })).toBeTruthy();
  expect((source("Lunedì pranzo", week) as HTMLSelectElement).value).toBe("");
  expect(week.queryByLabelText("Quantità Lunedì pranzo (g)")).toBeNull();

  await user.selectOptions(source("Lunedì pranzo", week), "Uova");
  expect(grams("Lunedì pranzo (g)", week)).toBe("120");
  await user.click(week.getByLabelText("Lunedì pranzo: 3 uova (180 g)"));
  expect(grams("Lunedì pranzo (g)", week)).toBe("180");

  await user.selectOptions(
    source("Giovedì cena", week),
    "Tonno/pesce in scatola",
  );
  expect(grams("Giovedì cena (g)", week)).toBe("52");
  await user.click(week.getByLabelText("Giovedì cena: tonno 78 g"));
  expect(grams("Giovedì cena (g)", week)).toBe("78");
  expect(week.queryByLabelText(/Lunedì cena: /)).toBeNull();

  // A new source starts again from its own proposal.
  await type(user, "Quantità Lunedì pranzo (g)", "200", week);
  await user.selectOptions(source("Lunedì pranzo", week), "Affettati");
  expect(grams("Lunedì pranzo (g)", week)).toBe("80");
  await user.selectOptions(source("Lunedì pranzo", week), "Nessuna");
  expect(week.queryByLabelText("Quantità Lunedì pranzo (g)")).toBeNull();
});

it("computes white meat and fish from the red-meat base", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const week = section("Fonti proteiche");

  // White meat and fish follow the red-meat base written by the nutritionist.
  await user.selectOptions(source("Martedì cena", week), "Pesce");
  await user.selectOptions(source("Mercoledì pranzo", week), "Carne bianca");
  expect(grams("Martedì cena (g)", week)).toBe("");
  for (const day of ["Martedì", "Mercoledì"])
    expect(
      within(week.getByRole("group", { name: day })).getByText(
        "Inserisci la base carne rossa",
      ),
    ).toBeTruthy();
  await type(user, "Carne rossa, quantità base (g)", "100", week);
  expect(grams("Martedì cena (g)", week)).toBe("150");
  expect(grams("Mercoledì pranzo (g)", week)).toBe("130");
  await type(user, "Carne rossa, quantità base (g)", "120", week);
  expect(grams("Martedì cena (g)", week)).toBe("180");
  expect(grams("Mercoledì pranzo (g)", week)).toBe("155");

  await type(user, "Quantità Martedì cena (g)", "170", week);
  await user.click(
    week.getByRole("button", {
      name: "Ripristina Quantità Martedì cena (g): 180 calcolati",
    }),
  );
  expect(grams("Martedì cena (g)", week)).toBe("180");
});

it("counts each source in the week against the recommended frequencies", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const week = section("Fonti proteiche");

  await user.selectOptions(source("Lunedì pranzo", week), "Formaggio fresco");
  await user.selectOptions(source("Lunedì cena", week), "Formaggio stagionato");
  await user.selectOptions(source("Martedì pranzo", week), "Formaggio fresco");
  await user.selectOptions(source("Martedì cena", week), "Uova");
  const counts = week.getByRole("table", { name: "Frequenze settimanali" });
  const row = (name: RegExp) => within(counts).getByRole("row", { name });
  const cells = (name: RegExp) =>
    within(row(name))
      .getAllByRole("cell")
      .map((cell) => cell.textContent);
  expect(cells(/^Formaggi/)).toEqual(["3", "1–2", "Sopra"]);
  expect(row(/^Formaggi/).textContent).toContain("fresco 2 · stagionato 1");
  expect(row(/^Formaggi/).className).toBe("warning");
  expect(cells(/^Uova/)).toEqual(["1", "1–2", "Nell'intervallo"]);
  expect(row(/^Uova/).className).toBe("");
  expect(cells(/^Carne rossa/)).toEqual(["0", "0–1", "Nell'intervallo"]);
  expect(cells(/^Pesce/)).toEqual(["0", "2–4", "Sotto"]);
  expect(within(counts).getAllByRole("row")).toHaveLength(9); // head + 8
});

const savedIntake = {
  breakfast: { choice: "yogurt" },
  snacks: { nutsGrams: 15, yogurtGrams: 0 },
} satisfies Partial<DietSchema>;
const savedPizza = {
  pizza: { breadGrams: 60, whiteMeatGrams: 120 },
} satisfies Partial<DietSchema>;
const savedWeek = {
  proteinWeek: {
    redMeatGrams: 100,
    days: {
      venerdi: { dinner: { source: "carne_rossa" } },
      sabato: { lunch: { source: "uova", exception: true } },
      domenica: { lunch: { source: "legumi_secchi", grams: 60 } },
    },
  },
} satisfies Partial<DietSchema>;

it("edits breakfast and snacks and saves them", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const intake = section("Colazione e spuntini");

  expect(value("Latte a colazione (ml)", intake)).toBe("150");
  expect(value("Frutta secca spuntino (g)", intake)).toBe("20");
  expect(value("Yogurt spuntino (g)", intake)).toBe("125");

  await type(user, "Latte a colazione (ml)", "200", intake);
  await user.click(intake.getByRole("radio", { name: "Yogurt" }));
  expect(intake.queryByLabelText("Latte a colazione (ml)")).toBeNull();
  expect(value("Yogurt a colazione (g)", intake)).toBe("125");
  await type(user, "Frutta secca spuntino (g)", "15", intake);
  await type(user, "Yogurt spuntino (g)", "0", intake);

  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(schemas.get(1)).toEqual({
    ...emptySchema(),
    kcal: 1800,
    ...savedIntake,
  });
});

it("proposes the extra pizza day, its lunch from the red-meat base", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const pizza = section("Giorno pizza (in più)");

  expect(pizza.getByText(/non è uno dei sette giorni/)).toBeTruthy();
  expect(value("Pane giorno pizza (g)", pizza)).toBe("50");
  expect(value("Olio giorno pizza (ml)", pizza)).toBe("10");
  // Without the base, like the weekdays: empty, asking for it.
  expect(value("Carne bianca pranzo pizza (g)", pizza)).toBe("");
  expect(value("Pesce pranzo pizza (g)", pizza)).toBe("");
  expect(pizza.getAllByText("Inserisci la base carne rossa")).toHaveLength(2);

  await type(
    user,
    "Carne rossa, quantità base (g)",
    "100",
    section("Fonti proteiche"),
  );
  expect(value("Carne bianca pranzo pizza (g)", pizza)).toBe("130");
  expect(value("Pesce pranzo pizza (g)", pizza)).toBe("150");
  expect(pizza.queryByText("Inserisci la base carne rossa")).toBeNull();
});

it("corrects the pizza day and saves only the corrections", async () => {
  const base = { proteinWeek: { redMeatGrams: 100 } };
  schemas.set(1, { ...emptySchema(), kcal: 1800, ...base });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const pizza = section("Giorno pizza (in più)");

  await type(user, "Pane giorno pizza (g)", "60", pizza);
  await type(user, "Olio giorno pizza (ml)", "5", pizza);
  await type(user, "Pesce pranzo pizza (g)", "140", pizza);
  await type(user, "Carne bianca pranzo pizza (g)", "120", pizza);
  expect(
    pizza
      .getByLabelText("Carne bianca pranzo pizza (g)")
      .closest(".quantity")
      ?.classList.contains("overridden"),
  ).toBe(true);
  await user.click(
    pizza.getByRole("button", {
      name: "Ripristina Olio giorno pizza (ml): 10 calcolati",
    }),
  );
  await user.click(
    pizza.getByRole("button", {
      name: "Ripristina Pesce pranzo pizza (g): 150 calcolati",
    }),
  );
  expect(value("Olio giorno pizza (ml)", pizza)).toBe("10");
  expect(value("Pesce pranzo pizza (g)", pizza)).toBe("150");

  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(schemas.get(1)).toEqual({
    ...emptySchema(),
    kcal: 1800,
    ...base,
    ...savedPizza,
  });
});

it("saves the protein choices of the week", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const week = section("Fonti proteiche");

  await user.selectOptions(source("Venerdì cena", week), "Carne rossa");
  await type(user, "Carne rossa, quantità base (g)", "100", week);
  await user.selectOptions(source("Sabato pranzo", week), "Uova");
  await user.click(week.getByLabelText("Sabato pranzo: 3 uova (180 g)"));
  await user.selectOptions(source("Domenica pranzo", week), "Legumi secchi");
  await type(user, "Quantità Domenica pranzo (g)", "60", week);
  await user.selectOptions(source("Lunedì cena", week), "Pesce");
  await user.selectOptions(source("Lunedì cena", week), "Nessuna");

  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(schemas.get(1)).toEqual({
    ...emptySchema(),
    kcal: 1800,
    ...savedWeek,
  });
});

it("reopens the saved breakfast, snacks, pizza day and protein week", async () => {
  schemas.set(1, {
    ...emptySchema(),
    kcal: 1800,
    ...savedIntake,
    ...savedPizza,
    ...savedWeek,
  });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const intake = section("Colazione e spuntini");
  const week = section("Fonti proteiche");
  const pizza = section("Giorno pizza (in più)");
  expect(value("Pane giorno pizza (g)", pizza)).toBe("60");
  expect(value("Olio giorno pizza (ml)", pizza)).toBe("10");
  expect(value("Carne bianca pranzo pizza (g)", pizza)).toBe("120");
  expect(value("Pesce pranzo pizza (g)", pizza)).toBe("150");
  expect(value("Yogurt a colazione (g)", intake)).toBe("125");
  expect(value("Frutta secca spuntino (g)", intake)).toBe("15");
  expect(value("Yogurt spuntino (g)", intake)).toBe("0");
  expect(value("Carne rossa, quantità base (g)", week)).toBe("100");
  expect(grams("Venerdì cena (g)", week)).toBe("100");
  expect(grams("Sabato pranzo (g)", week)).toBe("180");
  expect(
    (week.getByLabelText("Sabato pranzo: 3 uova (180 g)") as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(grams("Domenica pranzo (g)", week)).toBe("60");
  expect((source("Lunedì cena", week) as HTMLSelectElement).value).toBe("");
  expect(screen.getByRole("status", { name: "Schema" }).textContent).toBe(
    "Schema caricato.",
  );
});
