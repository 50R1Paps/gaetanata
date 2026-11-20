// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { type UserEvent, userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";

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
});
