// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, {
  PointerEventsCheckLevel,
  type UserEvent,
} from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { ageAt, basalMetabolism } from "../calc";
import { formatNumber } from "../format";
import { localToday, type Patient } from "../patient";
import { emptyWeekPlan } from "../plan";
import { type DietSchema, emptySchema } from "../schema";

// The real API is tested over HTTP in server/schemas.test.ts; here an
// in-memory stand-in answers the same routes. Fake, anonymous people only.
const patients: Patient[] = [
  {
    id: 1,
    name: "Prova Uno",
    birthDate: "1990-05-10",
    sex: "female",
    weightKg: 60,
    heightCm: 165,
  },
  {
    id: 2,
    name: "Prova Due",
    birthDate: "1985-01-20",
    sex: "male",
    weightKg: null,
    heightCm: null,
  },
];
let schemas: Map<number, DietSchema>;
let offline: boolean;

beforeEach(() => {
  schemas = new Map();
  offline = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (offline) throw new TypeError("fetch failed");
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
  // jsdom does not implement native dialog display.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** Switches to the Schema view first: without a patient it is nearly empty,
 * unlike the plan view with its food list, so the dialog queries stay fast. */
async function openSchema(user: UserEvent, name: string) {
  await user.click(screen.getByRole("radio", { name: "Schema" }));
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(
    await dialog.findByRole("button", { name: new RegExp(`^${name}`) }),
  );
  await screen.findByText("Schema caricato.");
  await user.click(dialog.getByRole("button", { name: "Chiudi" }));
}

// Every event re-renders the whole Schema: no per-keystroke timers, no
// computed-style walk before each pointer action.
const setup = () =>
  userEvent.setup({
    delay: null,
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });

/** Replaces the field's text in one input event, as pasting would: the
 * fields keep the typed text, so a keystroke at a time adds nothing. */
async function type(user: UserEvent, label: string, text: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.paste(text);
}

const value = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

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
  expect(within(lunch).getByText("40 %")).toBeTruthy();
  expect(within(lunch).getByText("720")).toBeTruthy();
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

  const protein = screen.getByRole("table", { name: "Proteine per kg" });
  const real = within(protein).getByRole("row", { name: /^Peso reale/ });
  expect(within(real).getByText("1,50")).toBeTruthy();
  expect(within(real).getByText("Sopra 1,4")).toBeTruthy();
  const bmi25 = within(protein).getByRole("row", { name: /BMI 25/ });
  expect(within(bmi25).getByText("Nell'intervallo")).toBeTruthy();
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

const source = (meal: string) => screen.getByLabelText(`Fonte ${meal}`);
const grams = (meal: string) => value(`Quantità ${meal}`);

it("chooses lunch and dinner protein sources with their starting quantities", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  const week = within(screen.getByRole("region", { name: "Fonti proteiche" }));
  for (const day of ["Lunedì", "Domenica"])
    expect(week.getByRole("group", { name: day })).toBeTruthy();
  expect((source("Lunedì pranzo") as HTMLSelectElement).value).toBe("");
  expect(screen.queryByLabelText("Quantità Lunedì pranzo (g)")).toBeNull();

  await user.selectOptions(source("Lunedì pranzo"), "Uova");
  expect(grams("Lunedì pranzo (g)")).toBe("120");
  await user.click(screen.getByLabelText("Lunedì pranzo: 3 uova (180 g)"));
  expect(grams("Lunedì pranzo (g)")).toBe("180");

  await user.selectOptions(source("Giovedì cena"), "Tonno/pesce in scatola");
  expect(grams("Giovedì cena (g)")).toBe("52");
  await user.click(screen.getByLabelText("Giovedì cena: tonno 78 g"));
  expect(grams("Giovedì cena (g)")).toBe("78");
  expect(screen.queryByLabelText(/Lunedì cena: /)).toBeNull();

  // A new source starts again from its own proposal.
  await type(user, "Quantità Lunedì pranzo (g)", "200");
  await user.selectOptions(source("Lunedì pranzo"), "Affettati");
  expect(grams("Lunedì pranzo (g)")).toBe("80");
  await user.selectOptions(source("Lunedì pranzo"), "Nessuna");
  expect(screen.queryByLabelText("Quantità Lunedì pranzo (g)")).toBeNull();
});

it("computes white meat and fish from the red-meat base", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  const week = within(screen.getByRole("region", { name: "Fonti proteiche" }));

  // White meat and fish follow the red-meat base written by the nutritionist.
  await user.selectOptions(source("Martedì cena"), "Pesce");
  await user.selectOptions(source("Mercoledì pranzo"), "Carne bianca");
  expect(grams("Martedì cena (g)")).toBe("");
  expect(week.getAllByText("Inserisci la base carne rossa")).toHaveLength(2);
  await type(user, "Carne rossa, quantità base (g)", "100");
  expect(grams("Martedì cena (g)")).toBe("150");
  expect(grams("Mercoledì pranzo (g)")).toBe("130");
  await type(user, "Carne rossa, quantità base (g)", "120");
  expect(grams("Martedì cena (g)")).toBe("180");
  expect(grams("Mercoledì pranzo (g)")).toBe("155");

  await type(user, "Quantità Martedì cena (g)", "170");
  await user.click(
    screen.getByRole("button", {
      name: "Ripristina Quantità Martedì cena (g): 180 calcolati",
    }),
  );
  expect(grams("Martedì cena (g)")).toBe("180");
});

it("counts each source in the week against the recommended frequencies", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  await user.selectOptions(source("Lunedì pranzo"), "Formaggio fresco");
  await user.selectOptions(source("Lunedì cena"), "Formaggio stagionato");
  await user.selectOptions(source("Martedì pranzo"), "Formaggio fresco");
  await user.selectOptions(source("Martedì cena"), "Uova");
  const counts = screen.getByRole("table", { name: "Frequenze settimanali" });
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
  pizza: { breadGrams: 60 },
  breakfast: { choice: "yogurt" },
  snacks: { nutsGrams: 15, yogurtGrams: 0 },
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

it("edits breakfast, snacks and the extra pizza day and saves them", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  const pizza = within(
    screen.getByRole("region", { name: "Giorno pizza (in più)" }),
  );
  expect(pizza.getByText(/non è uno dei sette giorni/)).toBeTruthy();
  expect(value("Pane giorno pizza (g)")).toBe("50");
  expect(value("Olio giorno pizza (ml)")).toBe("10");
  expect(value("Latte a colazione (ml)")).toBe("150");
  expect(value("Frutta secca spuntino (g)")).toBe("20");
  expect(value("Yogurt spuntino (g)")).toBe("125");

  await type(user, "Olio giorno pizza (ml)", "5");
  expect(
    screen.getByRole("button", {
      name: "Ripristina Olio giorno pizza (ml): 10 calcolati",
    }),
  ).toBeTruthy();
  await type(user, "Pane giorno pizza (g)", "60");
  await type(user, "Latte a colazione (ml)", "200");
  await user.click(screen.getByRole("radio", { name: "Yogurt" }));
  expect(screen.queryByLabelText("Latte a colazione (ml)")).toBeNull();
  expect(value("Yogurt a colazione (g)")).toBe("125");
  await type(user, "Frutta secca spuntino (g)", "15");
  await type(user, "Yogurt spuntino (g)", "0");
  await user.click(
    screen.getByRole("button", {
      name: "Ripristina Olio giorno pizza (ml): 10 calcolati",
    }),
  );

  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(schemas.get(1)).toEqual({
    ...emptySchema(),
    kcal: 1800,
    ...savedIntake,
  });
});

it("saves the protein choices of the week", async () => {
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  await user.selectOptions(source("Venerdì cena"), "Carne rossa");
  await type(user, "Carne rossa, quantità base (g)", "100");
  await user.selectOptions(source("Sabato pranzo"), "Uova");
  await user.click(screen.getByLabelText("Sabato pranzo: 3 uova (180 g)"));
  await user.selectOptions(source("Domenica pranzo"), "Legumi secchi");
  await type(user, "Quantità Domenica pranzo (g)", "60");
  await user.selectOptions(source("Lunedì cena"), "Pesce");
  await user.selectOptions(source("Lunedì cena"), "Nessuna");

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
    ...savedWeek,
  });
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  expect(value("Pane giorno pizza (g)")).toBe("60");
  expect(value("Olio giorno pizza (ml)")).toBe("10");
  expect(value("Yogurt a colazione (g)")).toBe("125");
  expect(value("Frutta secca spuntino (g)")).toBe("15");
  expect(value("Yogurt spuntino (g)")).toBe("0");
  expect(value("Carne rossa, quantità base (g)")).toBe("100");
  expect(grams("Venerdì cena (g)")).toBe("100");
  expect(grams("Sabato pranzo (g)")).toBe("180");
  expect(
    (screen.getByLabelText("Sabato pranzo: 3 uova (180 g)") as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(grams("Domenica pranzo (g)")).toBe("60");
  expect((source("Lunedì cena") as HTMLSelectElement).value).toBe("");
  expect(screen.getByRole("status", { name: "Schema" }).textContent).toBe(
    "Schema caricato.",
  );
});
