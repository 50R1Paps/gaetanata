// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, {
  PointerEventsCheckLevel,
  type UserEvent,
} from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import type { Patient } from "../patient";
import { emptyWeekPlan, type WeekPlan } from "../plan";
import { type DietSchema, emptySchema } from "../schema";

// The conversion is tested in src/schemaToPlan.test.ts; here only the
// command in the Schema screen. Fake, anonymous people only.
const patients: Patient[] = [
  {
    id: 1,
    name: "Prova Uno",
    birthDate: "1990-05-10",
    sex: "female",
    weightKg: 60,
    heightCm: 165,
  },
];
let schema: DietSchema;
let plan: WeekPlan;

beforeEach(() => {
  schema = emptySchema();
  plan = emptyWeekPlan();
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/patients") return Response.json({ patients });
    if (path === "/api/template") return Response.json({ available: false });
    const document = path.split("/")[4];
    if (document === "plan") return Response.json(plan);
    if (document === "documents") return Response.json({ documents: [] });
    return Response.json(schema);
  });
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

const setup = () =>
  userEvent.setup({
    delay: null,
    pointerEventsCheck: PointerEventsCheckLevel.Never,
  });

/** Schema view first, as in SchemaScreen.test.tsx: smaller DOM to query. */
async function openSchema(user: UserEvent) {
  await user.click(screen.getByRole("radio", { name: "Schema" }));
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const dialog = within(screen.getByRole("dialog"));
  await user.click(await dialog.findByRole("button", { name: /^Prova Uno/ }));
  await screen.findByText("Schema caricato.");
  await user.click(dialog.getByRole("button", { name: "Chiudi" }));
}

const fill = () =>
  screen.getByRole("button", { name: "Riempi il piano settimanale" });
const planStatus = () =>
  screen.getByRole("status", { name: "Piano settimanale" }).textContent;
const grams = (food: string) =>
  screen
    .queryAllByLabelText(`Grammi di ${food}`)
    .map((input) => (input as HTMLInputElement).value);

it("fills only from a calculated schema", async () => {
  const user = setup();
  render(<App />);
  await openSchema(user);

  expect(fill().hasAttribute("disabled")).toBe(true);
  expect(
    document.getElementById(fill().getAttribute("aria-describedby") ?? "")
      ?.textContent,
  ).toBe("Completa lo schema per riempire il piano.");
});

it("fills an empty plan, unsaved, and lists the meals left out", async () => {
  schema = {
    ...emptySchema(),
    kcal: 1800,
    proteinWeek: {
      days: {
        lunedi: {
          lunch: { source: "legumi_scatola" },
          dinner: { source: "uova" },
        },
        martedi: { dinner: { source: "carne_bianca" } },
      },
    },
  };
  const user = setup();
  render(<App />);
  await openSchema(user);

  await user.click(fill());
  expect(screen.queryByRole("button", { name: "Sostituisci il piano" })).toBe(
    null,
  );
  expect(planStatus()).toBe("Piano modificato, non salvato.");
  const skipped = within(
    screen.getByRole("list", { name: "Pasti non riempiti" }),
  );
  expect(
    skipped.getAllByRole("listitem").map((item) => item.textContent),
  ).toEqual([
    "Lunedì pranzo, Legumi in scatola: Nessun alimento rappresentativo con categoria certa disponibile",
    "Martedì cena, Carne bianca: manca la quantità base di carne rossa",
  ]);

  await user.click(screen.getByRole("radio", { name: "Piano settimanale" }));
  expect(grams("Pasta di semola")).toEqual(["105"]);
  expect(grams("Pane bianco")).toEqual(["145"]);
  expect(grams("Uova")).toEqual(["120"]);
  expect(screen.getByRole("tab", { name: /^Lunedì/ }).textContent).not.toMatch(
    /Vuoto/,
  );
});

it("asks before replacing a plan that has foods", async () => {
  schema = { ...emptySchema(), kcal: 1800 };
  const days = emptyWeekPlan().days;
  plan = {
    days: days.map((day, index) =>
      index === 0
        ? {
            ...day,
            meals: day.meals.map((meal, slot) =>
              slot === 2 ? [{ id: "a", food: "Grana", grams: 30 }] : meal,
            ),
          }
        : day,
    ),
  };
  const user = setup();
  render(<App />);
  await openSchema(user);

  await user.click(fill());
  expect(
    screen.getByText(
      "Il piano settimanale contiene già alimenti: sostituirlo con quello calcolato dallo schema?",
    ),
  ).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Annulla" }));
  expect(screen.queryByText(/contiene già alimenti/)).toBeNull();
  expect(planStatus()).toBe("Piano caricato.");

  await user.click(fill());
  await user.click(
    screen.getByRole("button", { name: "Sostituisci il piano" }),
  );
  expect(planStatus()).toBe("Piano modificato, non salvato.");
  expect(screen.queryByRole("list", { name: "Pasti non riempiti" })).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Piano settimanale" }));
  expect(grams("Grana")).toEqual([]);
  expect(grams("Pasta di semola")).toEqual(["105"]);
});
