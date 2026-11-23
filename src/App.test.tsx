// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { type UserEvent, userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { mealSlots } from "./calc";
import { patients, stubDialogs } from "./components/schemaTestKit";
import type { DraftInput } from "./draftApi";
import { addPortion, emptyWeekPlan } from "./plan";
import { emptySchema } from "./schema";

beforeEach(() => {
  vi.stubGlobal("fetch", async (path: string) =>
    path === "/api/draft"
      ? new Response(null, { status: 404 })
      : Response.json({ patients: [] }),
  );
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

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
  // The replaced row keeps focus on its grams, ready to adjust them.
  expect(document.activeElement).toBe(grams[0]);
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
  expect(document.activeElement).toBe(
    screen.getByRole("combobox", {
      name: `Aggiungi alimento a ${mealSlots[2]}`,
    }),
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

it("writes the patientless bozza one second after the last edit, with only the changed document", async () => {
  vi.useFakeTimers();
  let draft: unknown;
  const writes: unknown[] = [];
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft" && !init.method)
      return new Response(null, { status: 404 });
    if (path === "/api/draft" && init.method === "PUT") {
      draft = JSON.parse(String(init.body));
      writes.push(draft);
      return new Response(
        JSON.stringify({
          ...(draft as object),
          updatedAt: "2026-01-01T12:00:00Z",
        }),
      );
    }
    return new Response(JSON.stringify({ patients: [] }));
  });
  render(
    <App
      initialPlan={addPortion(emptyWeekPlan(), 0, 0, {
        id: "draft-row",
        food: "Noci",
        grams: 30,
      })}
    />,
  );
  const input = screen.getByLabelText("Grammi di Noci");
  fireEvent.change(input, { target: { value: "40" } });
  await act(() => vi.advanceTimersByTimeAsync(900));
  expect(writes).toEqual([]);
  fireEvent.change(input, { target: { value: "50" } });
  await act(() => vi.advanceTimersByTimeAsync(999));
  expect(writes).toEqual([]);
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(draft).toEqual({
    patientId: null,
    plan: addPortion(emptyWeekPlan(), 0, 0, {
      id: "draft-row",
      food: "Noci",
      grams: 50,
    }),
  });
  expect(writes).toHaveLength(1);
});

function draftEditor() {
  vi.useFakeTimers();
  stubDialogs();
  let draft: DraftInput | null = null;
  let savedPlan = addPortion(emptyWeekPlan(), 0, 0, {
    id: "saved-row",
    food: "Noci",
    grams: 30,
  });
  let savedSchema = emptySchema();
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft") {
      if (!init.method) return new Response(null, { status: 404 });
      draft = init.method === "DELETE" ? null : JSON.parse(String(init.body));
      return init.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ ...draft, updatedAt: "2026-01-01T12:00:00Z" });
    }
    if (path === "/api/patients") return Response.json({ patients });
    if (path.endsWith("/plan")) {
      if (init.method === "PUT") savedPlan = JSON.parse(String(init.body));
      return Response.json(savedPlan);
    }
    if (path.endsWith("/schema")) {
      if (init.method === "PUT") savedSchema = JSON.parse(String(init.body));
      return Response.json(savedSchema);
    }
    if (path.endsWith("/documents")) return Response.json({ documents: [] });
    return Response.json({ available: false });
  });
  render(<App />);
  return { draft: () => draft, savedPlan: () => savedPlan };
}

async function selectDraftPatient(name: string) {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Paziente:/ }));
  });
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: new RegExp(`^${name}`),
      }),
    );
  });
}

it("keeps only the unsaved schema after saving the plan, then removes the bozza after saving schema", async () => {
  const editor = draftEditor();
  await selectDraftPatient("Prova Uno");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Chiudi" }),
  );
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "45" },
  });
  fireEvent.click(screen.getByRole("radio", { name: "Schema" }));
  fireEvent.change(screen.getByLabelText("Kcal dieta"), {
    target: { value: "1800" },
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(editor.draft()).toMatchObject({
    patientId: 1,
    plan: addPortion(emptyWeekPlan(), 0, 0, {
      id: "saved-row",
      food: "Noci",
      grams: 45,
    }),
    schema: { kcal: 1800 },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salva piano" }));
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(editor.draft()).toMatchObject({
    patientId: 1,
    schema: { kcal: 1800 },
  });
  expect(editor.draft()).not.toHaveProperty("plan");
  expect(editor.savedPlan().days[0]?.meals[0]?.[0]?.grams).toBe(45);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Salva schema" }));
  });
  expect(editor.draft()).toBeNull();
});

it("deletes the bozza on Scarta e cambia without saving the discarded plan", async () => {
  const editor = draftEditor();
  await selectDraftPatient("Prova Uno");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Chiudi" }),
  );
  fireEvent.change(screen.getByLabelText("Grammi di Noci"), {
    target: { value: "60" },
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(editor.draft()?.patientId).toBe(1);
  await selectDraftPatient("Prova Due");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Scarta e cambia" }));
  });
  expect(editor.draft()).toBeNull();
  expect(editor.savedPlan().days[0]?.meals[0]?.[0]?.grams).toBe(30);
  expect(
    screen.getByRole("button", { name: "Paziente: Prova Due" }),
  ).toBeTruthy();
});

it("removes the bozza when edits return to the saved values", async () => {
  const editor = draftEditor();
  await selectDraftPatient("Prova Uno");
  fireEvent.click(
    within(screen.getByRole("dialog")).getByRole("button", { name: "Chiudi" }),
  );
  const input = screen.getByLabelText("Grammi di Noci");
  fireEvent.change(input, { target: { value: "60" } });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(editor.draft()?.plan?.days[0]?.meals[0]?.[0]?.grams).toBe(60);
  await act(async () => {
    fireEvent.change(input, { target: { value: "30" } });
  });
  expect(editor.draft()).toBeNull();
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).not.toContain("non salvato");
});

it("offers the dated patient bozza before editing and restores unsaved plan and schema", async () => {
  vi.useFakeTimers();
  const plan = addPortion(emptyWeekPlan(), 0, 0, {
    id: "recovered",
    food: "Noci",
    grams: 65,
  });
  let draft: DraftInput | null = {
    patientId: 1,
    plan,
    schema: { ...emptySchema(), kcal: 1850 },
  };
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft") {
      if (init.method === "PUT") draft = JSON.parse(String(init.body));
      return Response.json({ ...draft, updatedAt: "2026-01-15T12:34:00Z" });
    }
    if (path === "/api/patients") return Response.json({ patients });
    if (path.endsWith("/plan")) return Response.json(emptyWeekPlan());
    if (path.endsWith("/schema")) return Response.json(emptySchema());
    if (path.endsWith("/documents")) return Response.json({ documents: [] });
    return Response.json({ available: false });
  });
  await act(async () => {
    render(<App />);
  });
  const prompt = screen.getByRole("region", { name: "Bozza da recuperare" });
  expect(prompt.textContent).toContain("piano e schema di Prova Uno");
  expect(prompt.textContent).toContain(
    new Date("2026-01-15T12:34:00Z").toLocaleDateString("it-IT"),
  );
  expect(prompt.textContent).toContain(
    new Date("2026-01-15T12:34:00Z").toLocaleTimeString("it-IT", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );
  expect(
    screen.getByRole("combobox", { name: "Cerca alimento" }).closest("[inert]"),
  ).not.toBeNull();
  expect(
    screen.getByRole("button", { name: /Paziente:/ }).closest("[inert]"),
  ).not.toBeNull();
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
  });
  expect(
    screen.queryByRole("region", { name: "Bozza da recuperare" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Paziente: Prova Uno" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("Grammi di Noci").getAttribute("value")).toBe(
    "65",
  );
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).toContain("modificato, non salvato");
  expect(screen.getByRole("status", { name: "Schema" }).textContent).toContain(
    "modificato, non salvato",
  );
  fireEvent.click(screen.getByRole("radio", { name: "Schema" }));
  expect(screen.getByLabelText("Kcal dieta").getAttribute("value")).toBe(
    "1850",
  );
  fireEvent.change(screen.getByLabelText("Kcal dieta"), {
    target: { value: "1900" },
  });
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(draft?.schema?.kcal).toBe(1900);
  expect(draft?.plan).toEqual(plan);
});

function recoveryEditor(
  input: DraftInput,
  failure?: "plan" | "schema" | "discard" | "read",
) {
  vi.useFakeTimers();
  let draft: DraftInput | null = input;
  let failing = failure;
  const savedPlan = addPortion(emptyWeekPlan(), 0, 0, {
    id: "saved",
    food: "Noci",
    grams: 25,
  });
  const savedSchema = { ...emptySchema(), kcal: 1600 };
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft") {
      if (
        failing === "read" ||
        (failing === "discard" && init.method === "DELETE")
      )
        return Response.json(
          { error: "Disco non disponibile" },
          { status: 500 },
        );
      if (init.method === "DELETE") {
        draft = null;
        return new Response(null, { status: 204 });
      }
      if (init.method === "PUT") draft = JSON.parse(String(init.body));
      return draft
        ? Response.json({ ...draft, updatedAt: "2026-02-02T10:20:00Z" })
        : new Response(null, { status: 404 });
    }
    if (path === "/api/patients") return Response.json({ patients });
    if (failing && path.endsWith(`/${failing}`))
      return Response.json({ error: "Lettura interrotta" }, { status: 500 });
    if (path.endsWith("/plan")) return Response.json(savedPlan);
    if (path.endsWith("/schema")) return Response.json(savedSchema);
    if (path.endsWith("/documents")) return Response.json({ documents: [] });
    return Response.json({ available: false });
  });
  return {
    draft: () => draft,
    retry: () => {
      failing = undefined;
    },
  };
}

it.each(["plan", "schema"] as const)(
  "restores only the drafted %s over the saved patient documents",
  async (document) => {
    recoveryEditor({
      patientId: 1,
      ...(document === "plan"
        ? { plan: emptyWeekPlan() }
        : { schema: { ...emptySchema(), kcal: 1900 } }),
    });
    await act(async () => {
      render(<App />);
    });
    expect(
      screen.getByRole("region", { name: "Bozza da recuperare" }).textContent,
    ).toContain(`${document === "plan" ? "piano" : "schema"} di Prova Uno`);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
    });
    const planStatus = screen.getByRole("status", {
      name: "Piano settimanale",
    }).textContent;
    const schemaStatus = screen.getByRole("status", {
      name: "Schema",
    }).textContent;
    if (document === "plan") {
      expect(planStatus).toContain("modificato, non salvato");
      expect(schemaStatus).toBe("Schema caricato.");
      expect(screen.queryByLabelText("Grammi di Noci")).toBeNull();
    } else {
      expect(planStatus).toBe("Piano caricato.");
      expect(schemaStatus).toContain("modificato, non salvato");
      expect(
        screen.getByLabelText("Grammi di Noci").getAttribute("value"),
      ).toBe("25");
    }
    fireEvent.click(screen.getByRole("radio", { name: "Schema" }));
    expect(screen.getByLabelText("Kcal dieta").getAttribute("value")).toBe(
      document === "schema" ? "1900" : "1600",
    );
  },
);

it("restores a piano senza paziente without selecting a patient", async () => {
  recoveryEditor({
    patientId: null,
    plan: addPortion(emptyWeekPlan(), 0, 0, {
      id: "patientless",
      food: "Noci",
      grams: 70,
    }),
  });
  await act(async () => {
    render(<App />);
  });
  expect(
    screen.getByRole("region", { name: "Bozza da recuperare" }).textContent,
  ).toContain("piano senza paziente");
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
  });
  expect(
    screen.getByRole("button", { name: "Paziente: nessuno" }),
  ).toBeTruthy();
  expect(screen.getByLabelText("Grammi di Noci").getAttribute("value")).toBe(
    "70",
  );
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).toContain("modificato, non salvato");
});

it("discards the bozza and starts empty without opening its patient", async () => {
  const editor = recoveryEditor({ patientId: 1, plan: emptyWeekPlan() });
  await act(async () => {
    render(<App />);
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Scarta" }));
  });
  expect(editor.draft()).toBeNull();
  expect(
    screen.queryByRole("region", { name: "Bozza da recuperare" }),
  ).toBeNull();
  expect(
    screen.getByRole("button", { name: "Paziente: nessuno" }),
  ).toBeTruthy();
  expect(screen.queryByLabelText("Grammi di Noci")).toBeNull();
  expect(
    screen.getByRole("combobox", { name: "Cerca alimento" }).closest("[inert]"),
  ).toBeNull();
  await act(() => vi.advanceTimersByTimeAsync(1000));
  expect(editor.draft()).toBeNull();
});

it.each(["plan", "schema"] as const)(
  "keeps the bozza and all editors unchanged after %s load fails, then retries",
  async (failure) => {
    const original = {
      patientId: 1,
      plan: emptyWeekPlan(),
      schema: { ...emptySchema(), kcal: 1900 },
    };
    const editor = recoveryEditor(original, failure);
    await act(async () => {
      render(<App />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
    });
    expect(
      within(
        screen.getByRole("region", { name: "Bozza da recuperare" }),
      ).getByRole("alert").textContent,
    ).toContain("Lettura interrotta");
    expect(
      screen.getByRole("button", { name: "Paziente: nessuno" }),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Grammi di Noci")).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(2000));
    expect(editor.draft()).toEqual(original);
    expect(
      screen
        .getByRole("combobox", { name: "Cerca alimento" })
        .closest("[inert]"),
    ).not.toBeNull();
    editor.retry();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Ripristina" }));
    });
    expect(
      screen.queryByRole("region", { name: "Bozza da recuperare" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Paziente: Prova Uno" }),
    ).toBeTruthy();
  },
);

it.each(["read", "discard"] as const)(
  "keeps editing blocked after a failed bozza %s and allows retry",
  async (failure) => {
    const editor = recoveryEditor(
      { patientId: null, plan: emptyWeekPlan() },
      failure,
    );
    await act(async () => {
      render(<App />);
    });
    if (failure === "discard")
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Scarta" }));
      });
    expect(
      screen.getByRole("region", { name: "Bozza da recuperare" }).textContent,
    ).toContain("Disco non disponibile");
    expect(
      screen
        .getByRole("combobox", { name: "Cerca alimento" })
        .closest("[inert]"),
    ).not.toBeNull();
    expect(editor.draft()).not.toBeNull();
    editor.retry();
    if (failure === "read")
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Riprova" }));
      });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Scarta" }));
    });
    expect(editor.draft()).toBeNull();
  },
);
