// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";
import { App } from "./App";
import { addPortion, emptyWeekPlan } from "./plan";

afterEach(cleanup);

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
