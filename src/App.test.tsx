// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { type UserEvent, userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import { addPortion, emptyWeekPlan } from "./plan";

afterEach(cleanup);

function dayTab(name: string) {
  return screen.getByRole("tab", { name: new RegExp(`^${name}`) });
}

/** Asserts the selected tab, keyboard focus, panel and summary all show `name`. */
function expectShownDay(name: string) {
  const tab = dayTab(name);
  expect(screen.getAllByRole("tab", { selected: true })).toEqual([tab]);
  expect(document.activeElement).toBe(tab);
  const panel = screen.getByRole("tabpanel");
  expect(tab.getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("aria-labelledby")).toBe(tab.id);
  expect(screen.getByRole("heading", { name: `Totale ${name}` })).toBeDefined();
}

async function addFoodToSelectedDay(user: UserEvent) {
  await user.type(
    screen.getByRole("combobox", { name: "Cerca alimento" }),
    "Noci{Enter}",
  );
}

function gramsInputs() {
  return within(screen.getByRole("tabpanel")).queryAllByLabelText(
    /^Grammi di /,
  );
}

describe("day tabs", () => {
  it("Tab enters the group on the selected day and leaves it on the next Tab", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayTab("Mercoledì"));

    screen.getByRole("combobox", { name: "Cerca alimento" }).focus();
    await user.tab();
    expect(document.activeElement).toBe(dayTab("Mercoledì"));
    await user.tab();
    expect(screen.getByRole("tablist").contains(document.activeElement)).toBe(
      false,
    );
  });

  it("arrows select the next and previous day, wrapping around the week", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayTab("Lunedì"));

    await user.keyboard("{ArrowRight}");
    expectShownDay("Martedì");
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expectShownDay("Domenica");
    await user.keyboard("{ArrowRight}");
    expectShownDay("Lunedì");
  });

  it("Home selects Monday and End selects Sunday", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(dayTab("Giovedì"));

    await user.keyboard("{End}");
    expectShownDay("Domenica");
    await user.keyboard("{Home}");
    expectShownDay("Lunedì");
  });

  it("the panel shows the meals of the day reached by keyboard or click", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFoodToSelectedDay(user);
    expect(gramsInputs()).toHaveLength(1);

    await user.click(dayTab("Lunedì"));
    await user.keyboard("{ArrowRight}");
    expect(gramsInputs()).toHaveLength(0);
    await user.click(dayTab("Lunedì"));
    expectShownDay("Lunedì");
    expect(gramsInputs()).toHaveLength(1);
  });

  it("arrows typed in food and grams fields do not change day", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFoodToSelectedDay(user);

    await user.type(
      screen.getByRole("combobox", { name: "Cerca alimento" }),
      "pane{ArrowLeft}{ArrowRight}{Home}{End}",
    );
    const [grams] = gramsInputs();
    if (!grams) throw new Error("grams input missing");
    await user.click(grams);
    await user.keyboard("{ArrowLeft}{ArrowRight}{Home}{End}");

    expect(screen.getAllByRole("tab", { selected: true })).toEqual([
      dayTab("Lunedì"),
    ]);
    expect(document.activeElement).toBe(grams);
  });

  it("an empty day reads as empty on its tab, a day with food shows its kcal", async () => {
    const user = userEvent.setup();
    render(<App />);
    await addFoodToSelectedDay(user);

    expect(dayTab("Lunedì").textContent).toMatch(/\d kcal$/);
    expect(dayTab("Martedì").textContent).toBe("MartedìVuoto");
  });
});

it("the replace field of an unknown food sits outside the scrolling table and says what it replaces", async () => {
  const plan = addPortion(emptyWeekPlan(), 0, 0, {
    id: "unknown",
    food: "Zorbaluna inventata",
    grams: 37,
  });
  const user = userEvent.setup();
  render(<App initialPlan={plan} />);

  const replace = screen.getByRole("combobox", {
    name: "Sostituisci Zorbaluna inventata",
  });
  // Inside the table its suggestions would be clipped by the scroll box.
  expect(screen.getByRole("table").contains(replace)).toBe(false);
  expect(replace.getAttribute("placeholder")).toBe(
    "Sostituisci Zorbaluna inventata con…",
  );
  await user.type(replace, "Noc");
  const list = document.getElementById(
    replace.getAttribute("aria-controls") ?? "",
  );
  if (!list) throw new Error("suggestions missing");
  expect(list.hidden).toBe(false);
  expect(within(list).getByRole("option", { name: "Noci" })).toBeDefined();
});

it("opens a loaded plan, replaces or removes unknown rows without losing other portions", async () => {
  let plan = emptyWeekPlan();
  plan = addPortion(plan, 0, 0, {
    id: "unknown",
    food: "Zorbaluna inventata",
    grams: 37,
  });
  plan = addPortion(plan, 0, 0, { id: "known", food: "Noci", grams: 15 });
  plan = addPortion(plan, 1, 2, {
    id: "other",
    food: "Quarzopane inventato",
    grams: 91,
  });
  const saved = JSON.stringify(plan);
  const user = userEvent.setup();
  render(<App initialPlan={plan} />);
  expect(
    screen
      .getByRole("textbox", { name: "Grammi di Zorbaluna inventata" })
      .getAttribute("value"),
  ).toBe("37");
  expect(
    screen.getAllByText(/Alimento non riconosciuto/).length,
  ).toBeGreaterThan(0);
  expect(screen.getByText(/Media incompleta/)).toBeTruthy();
  await user.type(
    screen.getByRole("combobox", { name: "Sostituisci Zorbaluna inventata" }),
    "Noci{Enter}",
  );
  expect(
    screen.queryByRole("button", { name: "Rimuovi Zorbaluna inventata" }),
  ).toBeNull();
  const grams = screen.getAllByRole("textbox", { name: "Grammi di Noci" });
  expect(grams.map((input) => input.getAttribute("value"))).toEqual([
    "37",
    "15",
  ]);
  expect(screen.getByText(/Media incompleta/)).toBeTruthy();
  await user.click(screen.getByRole("tab", { name: /Martedì/ }));
  expect(
    screen
      .getByRole("textbox", { name: "Grammi di Quarzopane inventato" })
      .getAttribute("value"),
  ).toBe("91");
  await user.click(
    screen.getByRole("button", { name: "Rimuovi Quarzopane inventato" }),
  );
  expect(screen.queryByText(/Media incompleta/)).toBeNull();
  expect(screen.queryByText(/Alimento non riconosciuto/)).toBeNull();
  expect(screen.getByText("Media su 1 giorno su 7")).toBeTruthy();
  for (const name of [
    "Mercoledì",
    "Giovedì",
    "Venerdì",
    "Sabato",
    "Domenica",
    "Lunedì",
  ]) {
    await user.click(screen.getByRole("tab", { name: new RegExp(name) }));
    expect(
      within(screen.getByRole("tabpanel")).getAllByRole("heading", {
        level: 3,
      }),
    ).toHaveLength(6);
  }
  expect(
    screen
      .getAllByRole("textbox", { name: "Grammi di Noci" })
      .map((input) => input.getAttribute("value")),
  ).toEqual(["37", "15"]);
  expect(JSON.stringify(plan)).toBe(saved);
});
