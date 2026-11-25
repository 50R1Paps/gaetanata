// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import type { ErrorEntry } from "../report";
import { PatientManager } from "./PatientManager";
import { ReportProvider, useReport } from "./Report";
import { stubDialogs } from "./schemaTestKit";
import { VersionFooter } from "./VersionFooter";
import { WindowGate } from "./WindowGate";

beforeEach(stubDialogs);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function ErrorSource() {
  const report = useReport();
  return (
    <button
      type="button"
      onClick={() => report?.openReport("Salvataggio non riuscito, id 42")}
    >
      Apri con errore
    </button>
  );
}

function setup(active = true, errors: ErrorEntry[] = []) {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/health") return Response.json({ version: "1.2.3" });
    if (path === "/api/report")
      return Response.json({
        version: "1.2.3",
        system: "Windows 11",
        installation: "clone",
        errors,
      });
    if (path === "/api/window") return Response.json({ active });
    if (path === "/api/draft") return new Response(null, { status: 404 });
    return Response.json({ patients: [] });
  });
  render(
    <ReportProvider>
      <WindowGate>
        <App />
      </WindowGate>
      <VersionFooter />
    </ReportProvider>,
  );
}

it.each([true, false])(
  "opens from the footer in an active=%s window and requires a description for every action",
  async (active) => {
    setup(active);
    const user = userEvent.setup();
    if (active) await screen.findByRole("radio", { name: "Schema" });
    else await screen.findByText(/già aperta/);
    await user.click(screen.getByRole("button", { name: "Segnala problema" }));
    await screen.findByText(/Sistema operativo: Windows 11/);
    expect(
      screen.getByLabelText("Anteprima della segnalazione").textContent,
    ).toContain(
      `Schermata: ${active ? "Piano settimanale" : "Finestra non attiva"}`,
    );
    fireEvent.change(
      screen.getByLabelText("Cosa è successo o cosa ti serve?"),
      { target: { value: "   " } },
    );
    const open = vi.spyOn(window, "open");
    const copy = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    for (const name of [
      "Invia con Gmail",
      "Invia con il programma di posta",
      "Copia il testo",
    ]) {
      await user.click(screen.getByRole("button", { name }));
      expect(
        screen.getByText("Descrivi cosa è successo o cosa ti serve."),
      ).toBeTruthy();
    }
    expect(open).not.toHaveBeenCalled();
    expect(copy).not.toHaveBeenCalled();
    fireEvent.change(
      screen.getByLabelText("Cosa è successo o cosa ti serve?"),
      { target: { value: "Vorrei un aiuto & una funzione." } },
    );
    expect(
      screen.getByLabelText("Anteprima della segnalazione").textContent,
    ).toContain(
      "Vorrei un aiuto & una funzione.\n\nDati tecnici\nVersione: 1.2.3",
    );
  },
);

it("sends the exact preview with encoded recipient and subject through Gmail, mail and clipboard", async () => {
  setup(true, [
    {
      date: "2026-11-25T10:00:00.000Z",
      origin: "server",
      message: "Errore & dettaglio",
      stack: "Error\nframe",
    },
  ]);
  const user = userEvent.setup();
  await screen.findByRole("radio", { name: "Schema" });
  await user.click(screen.getByRole("radio", { name: "Schema" }));
  await user.click(screen.getByRole("button", { name: "Segnala problema" }));
  await screen.findByText(/Sistema operativo: Windows 11/);
  fireEvent.change(screen.getByLabelText("Cosa è successo o cosa ti serve?"), {
    target: { value: "Perché? È difficile & serve aiuto + dettagli #1." },
  });
  const body = screen.getByLabelText(
    "Anteprima della segnalazione",
  ).textContent;
  expect(body).toBe(
    "Perché? È difficile & serve aiuto + dettagli #1.\n\nDati tecnici\nVersione: 1.2.3\nSistema operativo: Windows 11\nInstallazione: clone\nSchermata: Schema\n\nUltimi errori:\n2026-11-25T10:00:00.000Z [server] Errore & dettaglio\nError\nframe",
  );
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  await user.click(screen.getByRole("button", { name: "Invia con Gmail" }));
  const gmail = new URL(String(open.mock.calls[0]?.[0]));
  expect(gmail.origin + gmail.pathname).toBe("https://mail.google.com/mail/");
  expect(Object.fromEntries(gmail.searchParams)).toEqual({
    view: "cm",
    to: "gaetanata.qualify006@simplelogin.com",
    su: "Segnalazione Gaetanata 1.2.3",
    body,
  });
  expect(open.mock.calls[0]?.slice(1)).toEqual([
    "_blank",
    "noopener,noreferrer",
  ]);
  await user.click(
    screen.getByRole("button", { name: "Invia con il programma di posta" }),
  );
  const mail = new URL(String(open.mock.calls[1]?.[0]));
  expect(mail.protocol).toBe("mailto:");
  expect(mail.pathname).toBe("gaetanata.qualify006@simplelogin.com");
  expect(Object.fromEntries(mail.searchParams)).toEqual({
    subject: "Segnalazione Gaetanata 1.2.3",
    body,
  });
  expect(open.mock.calls[1]?.[1]).toBe("_self");
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
  await user.click(screen.getByRole("button", { name: "Copia il testo" }));
  expect(copy).toHaveBeenCalledWith(body);
  expect(screen.getByText("Testo copiato negli appunti.")).toBeTruthy();
});

it("bounds the encoded mailto by trimming errors, preserving the description and using the same shortened text everywhere", async () => {
  setup(
    true,
    Array.from({ length: 5 }, (_, i) => ({
      date: "2026-11-25",
      origin: "server",
      message: `Errore ${i} ${"è𐐀&".repeat(1000)}`,
      stack: "frame".repeat(1000),
    })),
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Segnala problema" }));
  await screen.findByText(/Sistema operativo: Windows 11/);
  const description = "Ho bisogno di aiuto: perché? & + 𐐀";
  fireEvent.change(screen.getByLabelText("Cosa è successo o cosa ti serve?"), {
    target: { value: description },
  });
  const body = screen.getByLabelText(
    "Anteprima della segnalazione",
  ).textContent;
  expect(
    body?.startsWith(`${description}\n\nDati tecnici\nVersione: 1.2.3`),
  ).toBe(true);
  expect(body).toContain("Errori tagliati");
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  await user.click(
    screen.getByRole("button", { name: "Invia con il programma di posta" }),
  );
  const url = String(open.mock.calls[0]?.[0]);
  expect(url.length).toBeLessThanOrEqual(2000);
  expect(new URL(url).searchParams.get("body")).toBe(body);
  await user.click(screen.getByRole("button", { name: "Invia con Gmail" }));
  expect(
    new URL(String(open.mock.calls[1]?.[0])).searchParams.get("body"),
  ).toBe(body);
  const copy = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
  await user.click(screen.getByRole("button", { name: "Copia il testo" }));
  expect(copy).toHaveBeenCalledWith(body);
});

it("preserves even an oversized description and always retains the version", async () => {
  setup();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Segnala problema" }));
  await screen.findByText(/Sistema operativo: Windows 11/);
  const description = "Una richiesta molto lunga & dettagliata. ".repeat(100);
  fireEvent.change(screen.getByLabelText("Cosa è successo o cosa ti serve?"), {
    target: { value: description },
  });
  expect(
    screen.getByLabelText("Anteprima della segnalazione").textContent,
  ).toBe(`${description}\n\nDati tecnici\nVersione: 1.2.3`);
  const open = vi.spyOn(window, "open").mockReturnValue(null);
  await user.click(
    screen.getByRole("button", { name: "Invia con il programma di posta" }),
  );
  expect(
    new URL(String(open.mock.calls[0]?.[0])).searchParams.get("body"),
  ).toBe(`${description}\n\nDati tecnici\nVersione: 1.2.3`);
});

it("accepts an initial error through the shared opening seam, closes and starts a fresh report", async () => {
  setup(false);
  cleanup();
  render(
    <ReportProvider>
      <ErrorSource />
      <VersionFooter />
    </ReportProvider>,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Apri con errore" }));
  await screen.findByText(
    /Errore di partenza: Salvataggio non riuscito, id 42/,
  );
  await user.click(screen.getByRole("button", { name: "Chiudi" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Segnala problema" }));
  await screen.findByText(/Sistema operativo: Windows 11/);
  expect(
    screen.getByLabelText("Anteprima della segnalazione").textContent,
  ).not.toContain("Salvataggio");
  expect(
    screen
      .getByLabelText("Cosa è successo o cosa ti serve?")
      .getAttribute("value"),
  ).toBeNull();
});

it("opens a native modal and closes it on cancellation without sending", async () => {
  setup(false);
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Segnala problema" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.tagName).toBe("DIALOG");
  expect(dialog.hasAttribute("open")).toBe(true);
  fireEvent(dialog, new Event("cancel", { bubbles: true, cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("does not offer reporting when the server has stopped", async () => {
  vi.stubGlobal("fetch", async () => {
    throw new TypeError("offline");
  });
  render(
    <ReportProvider>
      <WindowGate>Contenuto</WindowGate>
    </ReportProvider>,
  );
  await screen.findByText(/Gaetanata si è chiusa/);
  expect(screen.queryByRole("button", { name: "Segnala problema" })).toBeNull();
});

it.each(["http", "network"])(
  "keeps all sending methods available without technical data (%s)",
  async (failure) => {
    vi.stubGlobal("fetch", async (path: string) => {
      if (path === "/api/health") return Response.json({ version: "1.2.3" });
      if (failure === "network") throw new TypeError("offline");
      return new Response(null, { status: 500 });
    });
    render(
      <ReportProvider>
        <ErrorSource />
        <VersionFooter />
      </ReportProvider>,
    );
    await screen.findByText(/Versione 1.2.3/);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Apri con errore" }));
    await screen.findByText(/dati tecnici non disponibili/i);
    fireEvent.change(
      screen.getByLabelText("Cosa è successo o cosa ti serve?"),
      {
        target: { value: "Non riesco a salvare." },
      },
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    const copy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText: copy } });
    const preview = screen.getByLabelText(
      "Anteprima della segnalazione",
    ).textContent;
    expect(preview).toContain("Versione: 1.2.3");
    expect(preview).toContain("Schermata: Finestra non attiva");
    expect(preview).toContain(
      "Errore di partenza: Salvataggio non riuscito, id 42",
    );
    for (const name of [
      "Invia con Gmail",
      "Invia con il programma di posta",
      "Copia il testo",
    ]) {
      const button = screen.getByRole("button", { name }) as HTMLButtonElement;
      expect(button.disabled).toBe(false);
      await user.click(button);
    }
    expect(
      new URL(String(open.mock.calls[0]?.[0])).searchParams.get("body"),
    ).toBe(preview);
    expect(
      new URL(String(open.mock.calls[1]?.[0])).searchParams.get("body"),
    ).toBe(preview);
    expect(copy).toHaveBeenCalledWith(preview);
    expect(screen.getByText(/dati tecnici non disponibili/i)).toBeTruthy();
  },
);

it.each([400, 500, "network"] as const)(
  "only offers reporting for a failed patient operation, not validation (%s)",
  async (status) => {
    vi.stubGlobal("fetch", async (_path: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        if (status === "network") throw new TypeError("offline");
        return Response.json({ error: "Richiesta non riuscita" }, { status });
      }
      return Response.json({ patients: [] });
    });
    render(
      <ReportProvider>
        <PatientManager selectedId={null} onSelect={async () => true} />
      </ReportProvider>,
    );
    await screen.findByText("Nessuna scheda salvata.");
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText("Nome (obbligatorio)"),
      "Persona Fittizia",
    );
    await user.click(screen.getByRole("button", { name: "Salva scheda" }));
    await screen.findByText(/Salvataggio non riuscito/);
    expect(
      Boolean(screen.queryByRole("button", { name: "Segnala problema" })),
    ).toBe(status !== 400);
  },
);
