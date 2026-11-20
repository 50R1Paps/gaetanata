// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Patient } from "../patient";
import { PatientManager } from "./PatientManager";

// The real API is tested over HTTP in server/patients.test.ts; here a small
// in-memory stand-in answers the same routes. Fake, anonymous people only.
let saved: Map<number, Patient>;
let nextId: number;
let offline: boolean;
let requests: string[];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function fakeApi(path: string, init: RequestInit = {}) {
  const method = init.method ?? "GET";
  requests.push(`${method} ${path}`);
  if (offline) throw new TypeError("fetch failed");
  const body = typeof init.body === "string" ? JSON.parse(init.body) : null;
  if (path === "/api/patients" && method === "GET")
    return json(200, {
      patients: [...saved.values()].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    });
  if (path === "/api/patients" && method === "POST") {
    const patient = { id: nextId++, ...body };
    saved.set(patient.id, patient);
    return json(201, patient);
  }
  const id = Number(path.split("/").pop());
  if (!saved.has(id))
    return json(404, { error: "Scheda paziente non trovata" });
  if (method === "PUT") {
    saved.set(id, { id, ...body });
    return json(200, saved.get(id));
  }
  if (method === "DELETE") {
    saved.delete(id);
    return new Response(null, { status: 204 });
  }
  return json(200, saved.get(id));
}

beforeEach(() => {
  saved = new Map();
  nextId = 1;
  offline = false;
  requests = [];
  vi.stubGlobal("fetch", fakeApi);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [selected, setSelected] = useState<Patient | null>(null);
  return (
    <>
      <output aria-label="Paziente attivo">
        {selected?.name ?? "nessuno"}
      </output>
      <PatientManager
        selectedId={selected?.id ?? null}
        onSelect={setSelected}
      />
    </>
  );
}

function entries() {
  return within(
    screen.getByRole("list", { name: "Schede pazienti" }),
  ).getAllByRole("button");
}

function input(label: string | RegExp) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

async function createPatient(user: UserEvent, name: string, weight = "") {
  await user.click(screen.getByRole("button", { name: "Nuova scheda" }));
  await user.type(input(/^Nome/), name);
  if (weight) await user.type(input("Peso (kg)"), weight);
  await user.click(screen.getByRole("button", { name: "Salva scheda" }));
  await screen.findByText("Scheda salvata.");
}

describe("patient manager", () => {
  it("creates, selects and edits patients with the same name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");

    await createPatient(user, "Paziente Prova", "70,5");
    await createPatient(user, "Paziente Prova");
    expect(screen.getByLabelText("Paziente attivo").textContent).toBe(
      "Paziente Prova",
    );
    expect(entries()).toHaveLength(2);

    await user.click(entries()[0] as HTMLElement);
    expect(input("Peso (kg)").value).toBe("70,5");
    await user.clear(input("Peso (kg)"));
    await user.type(input("Peso (kg)"), "69");
    await user.selectOptions(input("Sesso"), "Femmina");
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));
    await screen.findByText("Scheda salvata.");
    expect(saved.get(1)).toEqual({
      id: 1,
      name: "Paziente Prova",
      birthDate: null,
      sex: "female",
      weightKg: 69,
      heightCm: null,
    });

    await user.click(entries()[1] as HTMLElement);
    expect(input("Peso (kg)").value).toBe("");
    await user.click(entries()[0] as HTMLElement);
    expect(input("Peso (kg)").value).toBe("69");
  });

  it("shows the saved patients when opened again", async () => {
    saved.set(7, {
      id: 7,
      name: "Paziente Salvato",
      birthDate: "1990-03-04",
      sex: "male",
      weightKg: 80,
      heightCm: 180.5,
    });
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByText("Caricamento schede…")).toBeTruthy();
    await screen.findByRole("list", { name: "Schede pazienti" });

    await user.click(entries()[0] as HTMLElement);
    expect(input(/^Nome/).value).toBe("Paziente Salvato");
    expect(input("Data di nascita").value).toBe("1990-03-04");
    expect(input("Sesso").value).toBe("male");
    expect(input("Altezza (cm)").value).toBe("180,5");
  });

  it("explains invalid data and saves nothing", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");

    await user.click(screen.getByRole("button", { name: "Nuova scheda" }));
    await user.type(input("Peso (kg)"), "abc");
    await user.type(input("Altezza (cm)"), "0");
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));

    expect(screen.getByText("Inserisci il nome.")).toBeTruthy();
    expect(screen.getByText("Il peso deve essere un numero.")).toBeTruthy();
    expect(
      screen.getByText("L'altezza deve essere maggiore di zero."),
    ).toBeTruthy();
    expect(screen.queryByText("Scheda salvata.")).toBeNull();
    expect(requests).toEqual(["GET /api/patients"]);
  });

  it("shows the server's reasons when it rejects the data", async () => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) =>
      init.method === "POST"
        ? json(400, {
            error: "Dati non validi",
            fields: { name: "Inserisci il nome." },
          })
        : fakeApi(path, init),
    );
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");
    await user.type(input(/^Nome/), "Paziente Prova");
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));

    expect(
      await screen.findByText("Salvataggio non riuscito: Dati non validi"),
    ).toBeTruthy();
    expect(screen.getByText("Inserisci il nome.")).toBeTruthy();
    expect(screen.queryByText("Scheda salvata.")).toBeNull();
  });

  it("deletes only after confirmation, and never by changing selection", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");
    await createPatient(user, "Paziente Uno");
    await createPatient(user, "Paziente Due");

    await user.click(screen.getByRole("button", { name: "Elimina scheda" }));
    await user.click(entries()[0] as HTMLElement);
    expect(
      screen.queryByRole("button", { name: "Conferma eliminazione" }),
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: "Elimina scheda" }));
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(entries()).toHaveLength(2);
    expect(saved.size).toBe(2);

    await user.click(screen.getByRole("button", { name: "Elimina scheda" }));
    await user.click(
      screen.getByRole("button", { name: "Conferma eliminazione" }),
    );
    await screen.findByText("Scheda eliminata.");
    expect(entries().map((entry) => entry.textContent)).toEqual([
      "Paziente Uno",
    ]);
    expect([...saved.values()].map((patient) => patient.name)).toEqual([
      "Paziente Uno",
    ]);
    expect(screen.getByLabelText("Paziente attivo").textContent).toBe(
      "nessuno",
    );
  });

  it("shows a failed save without claiming the data was saved", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");
    offline = true;

    await user.type(input(/^Nome/), "Paziente Prova");
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));

    expect(await screen.findByText(/Salvataggio non riuscito/)).toBeTruthy();
    expect(screen.queryByText("Scheda salvata.")).toBeNull();
    expect(screen.getByLabelText("Paziente attivo").textContent).toBe(
      "nessuno",
    );
  });

  it("shows a read error with a retry", async () => {
    offline = true;
    const user = userEvent.setup();
    render(<Harness />);
    expect(
      await screen.findByText(/Impossibile leggere le schede/),
    ).toBeTruthy();

    offline = false;
    await user.click(screen.getByRole("button", { name: "Riprova" }));
    expect(await screen.findByText("Nessuna scheda salvata.")).toBeTruthy();
  });
});

describe("basal metabolism in the patient record", () => {
  beforeEach(() => {
    // Only the clock is fake: the age is computed at a fixed reference date.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 20, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function panel() {
    return within(screen.getByRole("region", { name: "Metabolismo basale" }));
  }

  function row(formula: string) {
    return panel().getByRole("row", { name: new RegExp(`^${formula}`) });
  }

  function chosenFormula() {
    return panel()
      .getAllByRole("row")
      .filter((each) => each.textContent?.includes("In uso"))
      .map((each) => within(each).getByRole("rowheader").textContent);
  }

  async function openFirst(user: UserEvent) {
    await screen.findByRole("list", { name: "Schede pazienti" });
    await user.click(entries()[0] as HTMLElement);
  }

  async function retype(user: UserEvent, label: string, text: string) {
    await user.clear(input(label));
    await user.type(input(label), text);
  }

  it("shows the three formulas, the one used, age and BMI", async () => {
    saved.set(1, {
      id: 1,
      name: "Paziente Prova",
      birthDate: "1986-11-20",
      sex: "male",
      weightKg: 80,
      heightCm: 180,
    });
    const user = userEvent.setup();
    render(<Harness />);
    await openFirst(user);

    // Coefficients from #1: 1796.995, 1732.4 and 1459 kcal.
    expect(row("Harris-Benedict").textContent).toContain("1797 kcal/giorno");
    expect(row("Mifflin-St Jeor").textContent).toContain("1732,4 kcal/giorno");
    expect(row("Bernstein").textContent).toContain("1459 kcal/giorno");
    expect(chosenFormula()).toEqual(["Harris-Benedict"]);
    expect(panel().getByText(/^Metabolismo basale usato:/).textContent).toBe(
      "Metabolismo basale usato: Harris-Benedict, 1797 kcal/giorno",
    );
    expect(panel().getByText(/^Età al 20\/11\/2026/).textContent).toBe(
      "Età al 20/11/2026: 40 anni",
    );
    // 80 / 1.8² = 24.691…
    expect(panel().getByText(/^BMI:/).textContent).toBe("BMI: 24,69");
    expect(
      panel().getByText(/non sono automaticamente le calorie da prescrivere/),
    ).toBeTruthy();
  });

  it("follows the unrounded BMI across the 25 and 30 thresholds", async () => {
    saved.set(1, {
      id: 1,
      name: "Paziente Prova",
      birthDate: "1986-11-20",
      sex: "female",
      weightKg: 99.96,
      heightCm: 200,
    });
    const user = userEvent.setup();
    render(<Harness />);
    await openFirst(user);

    // Height 2 m: BMI = weight / 4.
    const cases: [string, string, string][] = [
      ["99,96", "24,99", "Harris-Benedict"],
      ["100", "25", "Harris-Benedict"],
      ["100,04", "25,01", "Mifflin-St Jeor"],
      ["119,96", "29,99", "Mifflin-St Jeor"],
      ["120", "30", "Mifflin-St Jeor"],
      ["120,04", "30,01", "Bernstein"],
    ];
    for (const [weight, shownBmi, formula] of cases) {
      await retype(user, "Peso (kg)", weight);
      expect(panel().getByText(/^BMI:/).textContent).toBe(`BMI: ${shownBmi}`);
      expect(chosenFormula()).toEqual([formula]);
    }
    // Nothing was saved while trying the values.
    expect(saved.get(1)?.weightKg).toBe(99.96);
  });

  it("updates while typing and recalculates from the saved record", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");

    await user.type(input(/^Nome/), "Paziente Uno");
    await user.type(input("Data di nascita"), "1986-11-20");
    await user.selectOptions(input("Sesso"), "Femmina");
    await user.type(input("Peso (kg)"), "72,5");
    await user.type(input("Altezza (cm)"), "156");
    // BMI 29.79 → Mifflin: 9.99·72.5 + 6.25·156 − 4.92·40 − 161 = 1341.475
    expect(chosenFormula()).toEqual(["Mifflin-St Jeor"]);
    expect(row("Mifflin-St Jeor").textContent).toContain("1341,5 kcal/giorno");
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));
    await screen.findByText("Scheda salvata.");

    await createPatient(user, "Paziente Due");
    expect(panel().queryByText(/kcal\/giorno/)).toBeNull();

    await user.click(entries()[1] as HTMLElement);
    expect(input(/^Nome/).value).toBe("Paziente Uno");
    expect(chosenFormula()).toEqual(["Mifflin-St Jeor"]);
    expect(row("Mifflin-St Jeor").textContent).toContain("1341,5 kcal/giorno");
  });

  it("says what to complete instead of showing results", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");

    expect(
      panel().getByText(
        "Per calcolarlo completa: data di nascita, sesso, peso, altezza.",
      ),
    ).toBeTruthy();
    expect(panel().queryByRole("table")).toBeNull();

    await user.type(input("Data di nascita"), "1986-11-20");
    await user.selectOptions(input("Sesso"), "Maschio");
    await user.type(input("Peso (kg)"), "80");
    expect(panel().getByText("Per calcolarlo completa: altezza.")).toBeTruthy();
    expect(panel().queryByText(/kcal\/giorno|NaN/)).toBeNull();
  });

  it("says what to correct when a value is not valid", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await screen.findByText("Nessuna scheda salvata.");

    await user.type(input("Data di nascita"), "1986-11-20");
    await user.selectOptions(input("Sesso"), "Maschio");
    await user.type(input("Peso (kg)"), "abc");
    await user.type(input("Altezza (cm)"), "0");
    expect(
      panel().getByText(
        "Per calcolarlo correggi: Il peso deve essere un numero. L'altezza deve essere maggiore di zero.",
      ),
    ).toBeTruthy();
    expect(panel().queryByText(/kcal\/giorno|NaN/)).toBeNull();

    await retype(user, "Peso (kg)", "1");
    await retype(user, "Altezza (cm)", "1");
    expect(
      panel().getByText(
        "Con questi dati le formule non danno un valore plausibile: controlla data di nascita, peso e altezza.",
      ),
    ).toBeTruthy();
    expect(panel().queryByText(/kcal\/giorno|NaN/)).toBeNull();
  });
});
