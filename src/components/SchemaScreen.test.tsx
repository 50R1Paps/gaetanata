// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
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
    const [, , , id, document] = path.split("/");
    if (document === "plan") return Response.json(emptyWeekPlan());
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

async function openSchema(user: UserEvent, name: string) {
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  await user.click(
    await screen.findByRole("button", { name: new RegExp(`^${name}`) }),
  );
  await screen.findByText("Schema caricato.");
  await user.click(screen.getByRole("button", { name: "Chiudi" }));
  await user.click(screen.getByRole("radio", { name: "Schema" }));
}

async function type(user: UserEvent, label: string, text: string) {
  const input = screen.getByLabelText(label);
  await user.clear(input);
  await user.type(input, text);
}

const value = (label: string) =>
  (screen.getByLabelText(label) as HTMLInputElement).value;

it("says what to complete in the record instead of showing numbers", async () => {
  const user = userEvent.setup();
  render(<App />);
  await openSchema(user, "Prova Due");

  const screenArea = screen.getByRole("main", { name: "Schema" });
  expect(within(screenArea).getByText("Completa peso.")).toBeTruthy();
  expect(within(screenArea).getByText("Completa altezza.")).toBeTruthy();
  expect(within(screenArea).queryByRole("table")).toBeNull();
  expect(within(screenArea).queryByText(/kcal\/giorno/)).toBeNull();
});

it("starts from metabolism and fabbisogno, then splits the diet kcal", async () => {
  const user = userEvent.setup();
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
  const user = userEvent.setup();
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

it("saves, warns about unsaved changes and reopens the same schema", async () => {
  // Sections edited elsewhere (protein week, pizza) must survive a save here.
  const sections = {
    proteinWeek: { redMeatGrams: 100, days: { lunedi: { lunch: { source: "pesce" } } } },
    pizza: { breadGrams: 60 },
  } satisfies Partial<DietSchema>;
  schemas.set(1, { ...emptySchema(), ...sections });
  const user = userEvent.setup();
  const status = () =>
    screen.getByRole("status", { name: "Schema" }).textContent;
  const mounted = render(<App />);
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

  mounted.unmount();
  render(<App />);
  await openSchema(user, "Prova Uno");
  expect(value("Kcal dieta")).toBe("1800");
  expect(value("Carboidrati (%)")).toBe("50");
  expect(value("Proteine Cena (g)")).toBe("40");
  expect(status()).toBe("Schema caricato.");
});
