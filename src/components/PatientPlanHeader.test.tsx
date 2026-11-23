// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { App } from "../App";
import type { Patient } from "../patient";
import { addPortion, emptyWeekPlan, type WeekPlan } from "../plan";
import { loadPlan, savePlan } from "../plansApi";
import { PatientPlanHeader } from "./PatientPlanHeader";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [plan, setPlan] = useState(emptyWeekPlan);
  const [patient, setPatient] = useState<Patient | null>(null);
  return (
    <>
      <PatientPlanHeader
        patient={patient}
        setPatient={setPatient}
        documents={[
          {
            draftKey: "plan",
            noun: "piano",
            object: "il piano",
            label: "Piano settimanale",
            value: plan,
            setValue: setPlan,
            empty: emptyWeekPlan,
            load: loadPlan,
            save: savePlan,
          },
        ]}
      />
      <button
        type="button"
        onClick={() =>
          setPlan(
            addPortion(plan, 0, 0, {
              id: "row",
              food: "Sconosciuto",
              grams: 25,
            }),
          )
        }
      >
        Modifica piano
      </button>
      <output>{JSON.stringify(plan)}</output>
    </>
  );
}
it("loads, saves, cancels or discards switches, and preserves edits after failed save", async () => {
  const plans = new Map<number, WeekPlan>();
  let offline = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (offline) throw new Error("offline");
    if (path === "/api/patients")
      return Response.json({
        patients: [1, 2].map((id) => ({
          id,
          name: `Prova ${id}`,
          birthDate: null,
          sex: null,
          weightKg: null,
          heightCm: null,
        })),
      });
    const id = Number(path.split("/")[3]);
    if (init.method === "PUT") plans.set(id, JSON.parse(String(init.body)));
    return Response.json(plans.get(id) ?? emptyWeekPlan());
  });
  render(<Harness />);
  const user = userEvent.setup();
  // jsdom does not implement native dialog display; the test opens it via its button.
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const dialog = screen.getByRole("dialog");
  await user.click(
    await within(dialog).findByRole("button", { name: "Prova 1" }),
  );
  await screen.findByText("Piano caricato.");
  await user.click(screen.getByRole("button", { name: "Modifica piano" }));
  expect(screen.getByText("Piano modificato, non salvato.")).toBeTruthy();
  offline = true;
  await user.click(screen.getByRole("button", { name: "Salva piano" }));
  await screen.findAllByText(/Salvataggio piano non riuscito/);
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).not.toContain("Piano salvato.");
  offline = false;
  await user.click(within(dialog).getByRole("button", { name: "Prova 2" }));
  await user.click(screen.getByRole("button", { name: "Annulla cambio" }));
  expect(
    screen.getByRole("button", { name: "Paziente: Prova 1" }),
  ).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Prova 2" }));
  await user.click(screen.getByRole("button", { name: "Salva e cambia" }));
  await screen.findByRole("button", { name: "Paziente: Prova 2" });
  expect(plans.get(1)?.days[0]?.meals[0]).toEqual([
    { id: "row", food: "Sconosciuto", grams: 25 },
  ]);
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).toBe("Piano precedente salvato. Piano caricato.");
  await user.click(screen.getByRole("button", { name: "Modifica piano" }));
  await user.click(within(dialog).getByRole("button", { name: "Prova 1" }));
  await user.click(screen.getByRole("button", { name: "Scarta e cambia" }));
  await screen.findByRole("button", { name: "Paziente: Prova 1" });
  expect(plans.has(2)).toBe(false);
  expect(
    screen.getByRole("status", { name: "Piano settimanale" }).textContent,
  ).toBe("Piano caricato.");
});

it("keeps keyboard focus on a sensible control through switches and saves", async () => {
  let offline = false;
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (offline) throw new Error("offline");
    if (path === "/api/patients")
      return Response.json({
        patients: [1, 2].map((id) => ({
          id,
          name: `Prova ${id}`,
          birthDate: null,
          sex: null,
          weightKg: null,
          heightCm: null,
        })),
      });
    if (init.method === "PUT")
      return Response.json(JSON.parse(String(init.body)));
    return Response.json(emptyWeekPlan());
  });
  render(<Harness />);
  const user = userEvent.setup();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const status = () =>
    screen.getByRole("status", { name: "Piano settimanale" }).textContent;
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const dialog = within(screen.getByRole("dialog"));
  const button = (name: string) => screen.getByRole("button", { name });
  await user.click(await dialog.findByRole("button", { name: "Prova 1" }));
  await screen.findByText("Piano caricato.");
  expect(document.activeElement).toBe(button("Prova 1"));

  // Unsaved changes: the safe choice first, then back to what was pressed.
  await user.click(button("Modifica piano"));
  button("Prova 2").focus();
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(button("Annulla cambio"));
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(button("Prova 2"));
  button("Nuova scheda").focus();
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(button("Annulla cambio"));
  await user.keyboard("{Enter}");
  expect(document.activeElement).toBe(button("Nuova scheda"));

  // A failed "Salva e cambia" keeps focus on it for a retry.
  button("Prova 2").focus();
  await user.keyboard("{Enter}");
  offline = true;
  button("Salva e cambia").focus();
  await user.keyboard("{Enter}");
  await screen.findAllByText(/Salvataggio piano non riuscito/);
  expect(document.activeElement).toBe(button("Salva e cambia"));
  offline = false;
  await user.keyboard("{Enter}");
  await screen.findByRole("button", { name: "Paziente: Prova 2" });
  expect(status()).toBe("Piano precedente salvato. Piano caricato.");
  expect(document.activeElement).toBe(button("Prova 2"));

  // Switching to a new record lands on its first field.
  await user.click(button("Modifica piano"));
  button("Nuova scheda").focus();
  await user.keyboard("{Enter}");
  button("Scarta e cambia").focus();
  await user.keyboard("{Enter}");
  await screen.findByRole("button", { name: "Paziente: nessuno" });
  expect(status()).toBe("Seleziona un paziente per salvare il piano.");
  expect(document.activeElement).toBe(
    dialog.getByLabelText("Nome (obbligatorio)"),
  );

  await user.click(button("Prova 1"));
  await screen.findByText("Piano caricato.");
  await user.click(button("Modifica piano"));
  button("Salva piano").focus();
  await user.keyboard("{Enter}");
  await screen.findByText("Piano salvato.");
  expect(document.activeElement).toBe(button("Salva piano"));
});

it("reopens unknown foods through the editor and retains the current patient on load failure", async () => {
  let failRead = false;
  const stored = addPortion(emptyWeekPlan(), 0, 0, {
    id: "unknown",
    food: "Alimento archiviato",
    grams: 42,
  });
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/patients")
      return Response.json({
        patients: [1, 2].map((id) => ({
          id,
          name: `Prova ${id}`,
          birthDate: null,
          sex: null,
          weightKg: null,
          heightCm: null,
        })),
      });
    if (failRead)
      return Response.json({ error: "Lettura non riuscita" }, { status: 500 });
    return Response.json(stored);
  });
  const user = userEvent.setup();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute("open");
  };
  const mounted = render(<App />);
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  await user.click(await screen.findByRole("button", { name: "Prova 1" }));
  await screen.findByText("Piano caricato.");
  expect(
    screen
      .getByLabelText("Grammi di Alimento archiviato")
      .getAttribute("value"),
  ).toBe("42");
  expect(screen.getByText(/Alimenti non riconosciuti: correggi/)).toBeTruthy();
  failRead = true;
  await user.click(screen.getByRole("button", { name: "Prova 2" }));
  await screen.findAllByText(/Caricamento piano non riuscito/);
  expect(
    screen.getByRole("button", { name: "Paziente: Prova 1" }),
  ).toBeTruthy();
  expect(
    screen
      .getByLabelText("Grammi di Alimento archiviato")
      .getAttribute("value"),
  ).toBe("42");
  failRead = false;
  mounted.unmount();
  render(<App />);
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  await user.click(await screen.findByRole("button", { name: "Prova 1" }));
  await screen.findByText("Piano caricato.");
  expect(
    screen
      .getByLabelText("Grammi di Alimento archiviato")
      .getAttribute("value"),
  ).toBe("42");
});
