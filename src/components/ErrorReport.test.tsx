// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import { emptyWeekPlan } from "../plan";
import { emptySchema } from "../schema";
import { PatientManager } from "./PatientManager";
import { ReportProvider } from "./Report";
import { SchemaWordPanel } from "./SchemaWordPanel";
import { openSchema, patients, setup, stubDialogs } from "./schemaTestKit";
import { WindowGate } from "./WindowGate";

const technicalData = () =>
  Response.json({
    version: "0.1.0",
    system: "Windows",
    installation: "clone",
    errors: [],
  });

async function reportError(text: string) {
  const user = setup();
  const messages = await screen.findAllByText(text, {}, { timeout: 3000 });
  const message = messages.find(
    (element) => !element.closest("dialog:not([open])"),
  );
  if (!message) throw new Error("Messaggio non visibile");
  const alert = message.closest('[role="alert"]');
  if (!(alert instanceof HTMLElement))
    throw new Error("Messaggio senza contenitore di errore");
  await user.click(
    within(alert).getByRole("button", { name: "Segnala problema" }),
  );
  const preview = await screen.findByText(/Errore di partenza:/);
  expect(preview.textContent).toContain(`Errore di partenza: ${text}`);
  return preview.textContent ?? "";
}

beforeEach(stubDialogs);
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("segnala il caricamento delle schede fallito prima degli errori precedenti", async () => {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/report")
      return Response.json({
        version: "0.1.0",
        system: "Windows",
        installation: "clone",
        errors: [
          {
            date: "2026-11-25",
            origin: "server",
            message: "Errore precedente",
            stack: "",
          },
        ],
      });
    if (path === "/api/draft") return new Response(null, { status: 404 });
    return Response.json({ error: "Lettura interrotta" }, { status: 500 });
  });
  render(
    <ReportProvider>
      <App />
    </ReportProvider>,
  );
  const user = setup();
  await user.click(screen.getByRole("button", { name: /Paziente:/ }));
  const error = await screen.findByRole("alert");
  await user.click(
    within(error).getByRole("button", { name: "Segnala problema" }),
  );
  const preview = await screen.findByText(/Errore di partenza:/);
  expect(preview.textContent).toContain(
    "Errore di partenza: Impossibile leggere le schede: Lettura interrotta",
  );
  expect(preview.textContent?.indexOf("Lettura interrotta")).toBeLessThan(
    preview.textContent?.indexOf("Errore precedente") ?? 0,
  );
});

it.each(["stato", "caricamento", "generazione", "storico", "download"])(
  "segnala l'errore Word: %s senza nomi di file del paziente",
  async (failure) => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/report") return technicalData();
      const failed =
        (failure === "stato" && path === "/api/template") ||
        (failure === "caricamento" && init.method === "PUT") ||
        (failure === "generazione" && path.endsWith("/document")) ||
        (failure === "storico" && path.endsWith("/documents")) ||
        (failure === "download" && path.endsWith("/documents/7"));
      if (failed)
        return Response.json(
          { error: "Disco non disponibile" },
          { status: 500 },
        );
      if (path === "/api/template") return Response.json({ available: true });
      return Response.json({
        documents: [
          { id: 7, date: "2026-11-25", filename: "Persona Fittizia.docx" },
        ],
      });
    });
    render(
      <ReportProvider>
        <SchemaWordPanel patientId={1} schemaDirty={false} />
      </ReportProvider>,
    );
    const user = setup();
    await screen.findAllByText(
      failure === "stato"
        ? "Template Word non verificato."
        : "Template Word caricato.",
    );
    if (failure === "caricamento")
      await user.upload(
        screen.getByLabelText("File del template Word"),
        new File(["x"], "template.docx"),
      );
    if (failure === "generazione")
      await user.click(screen.getByRole("button", { name: "Genera Word" }));
    if (failure === "download")
      await user.click(
        await screen.findByRole("button", {
          name: "Scarica Persona Fittizia.docx",
        }),
      );
    const texts: Record<string, string> = {
      stato: "Stato del template non verificato: Disco non disponibile",
      caricamento: "Disco non disponibile",
      generazione: "Disco non disponibile",
      storico: "Storico non caricato: Disco non disponibile",
      download: "Download del Word non riuscito: Disco non disponibile",
    };
    const body = await reportError(texts[failure] ?? "");
    expect(body).not.toContain("Persona Fittizia");
  },
);

it.each(["piano", "schema"])(
  "segnala il salvataggio %s fallito dalla schermata reale",
  async (document) => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/report") return technicalData();
      if (path === "/api/draft") return new Response(null, { status: 404 });
      if (path === "/api/patients") return Response.json({ patients });
      if (init.method === "PUT")
        return Response.json({ error: "Disco pieno" }, { status: 500 });
      if (path.endsWith("/plan")) return Response.json(emptyWeekPlan());
      if (path.endsWith("/schema")) return Response.json(emptySchema());
      if (path === "/api/template") return Response.json({ available: false });
      return Response.json({ documents: [] });
    });
    render(
      <ReportProvider>
        <App />
      </ReportProvider>,
    );
    const user = setup();
    await openSchema(user, "Prova Uno");
    if (document === "schema") {
      await user.clear(screen.getByLabelText("Kcal dieta"));
      await user.type(screen.getByLabelText("Kcal dieta"), "1800");
    }
    await user.click(screen.getByRole("button", { name: `Salva ${document}` }));
    const body = await reportError(
      `Salvataggio ${document} non riuscito: Disco pieno`,
    );
    expect(body).not.toContain("Prova Uno");
  },
);

it.each(["failed", "available", "install"])(
  "segnala l'aggiornamento %s con entrambe le versioni",
  async (state) => {
    vi.stubGlobal("fetch", async (path: string) => {
      if (path === "/api/report") return technicalData();
      if (path === "/api/update")
        return Response.json(
          { error: "Aggiornamento non riuscito" },
          { status: 500 },
        );
      return Response.json({
        active: true,
        update:
          state === "failed"
            ? {
                status: "failed",
                message: "Aggiornamento non riuscito",
                failedUpdate: { installed: "0.1.0", attempted: "0.2.0" },
              }
            : {
                status: "available",
                version: state === "install" ? "0.2.0" : "0.3.0",
                notes: "",
                ...(state === "available"
                  ? {
                      failedMessage: "Aggiornamento non riuscito",
                      failedUpdate: { installed: "0.1.0", attempted: "0.2.0" },
                    }
                  : {}),
              },
      });
    });
    render(
      <ReportProvider>
        <WindowGate>
          <p>Editor</p>
        </WindowGate>
      </ReportProvider>,
    );
    const user = setup();
    if (state === "install")
      await user.click(
        await screen.findByRole("button", { name: "Installa aggiornamento" }),
      );
    const body = await reportError("Aggiornamento non riuscito");
    expect(body).toContain("Versione installata: 0.1.0");
    expect(body).toContain("Versione non riuscita: 0.2.0");
    expect(body).not.toContain("Versione non riuscita: 0.3.0");
  },
);

it.each(["Salva scheda", "Conferma eliminazione"])(
  "segnala l'operazione sulla scheda fallita: %s",
  async (action) => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/report") return technicalData();
      if (!init.method || init.method === "GET")
        return Response.json({ patients });
      return Response.json({ error: "Disco pieno" }, { status: 500 });
    });
    render(
      <ReportProvider>
        <PatientManager selectedId={1} onSelect={async () => true} />
      </ReportProvider>,
    );
    const user = setup();
    await screen.findByRole("heading", { name: "Modifica scheda" });
    if (action === "Conferma eliminazione")
      await user.click(screen.getByRole("button", { name: "Elimina scheda" }));
    await user.click(screen.getByRole("button", { name: action }));
    const body = await reportError(
      `${action === "Salva scheda" ? "Salvataggio non riuscito" : "Eliminazione non riuscita"}: Disco pieno`,
    );
    expect(body).not.toContain("Prova Uno");
  },
);

it.each(["plan", "schema"])(
  "segnala il caricamento %s fallito",
  async (document) => {
    vi.stubGlobal("fetch", async (path: string) => {
      if (path === "/api/report") return technicalData();
      if (path === "/api/draft") return new Response(null, { status: 404 });
      if (path === "/api/patients") return Response.json({ patients });
      if (path.endsWith(`/${document}`))
        return Response.json({ error: "Lettura interrotta" }, { status: 500 });
      return Response.json(emptyWeekPlan());
    });
    render(
      <ReportProvider>
        <App />
      </ReportProvider>,
    );
    const user = setup();
    await user.click(screen.getByRole("button", { name: /Paziente:/ }));
    await user.click(await screen.findByRole("button", { name: /^Prova Uno/ }));
    await reportError(
      `Caricamento ${document === "plan" ? "piano" : "schema"} non riuscito: Lettura interrotta. Seleziona di nuovo la scheda per riprovare.`,
    );
  },
);

it.each(["lettura", "scarto", "ripristino", "scrittura"])(
  "segnala il problema della bozza: %s",
  async (failure) => {
    vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
      if (path === "/api/report") return technicalData();
      if (path === "/api/patients") return Response.json({ patients });
      if (path === "/api/draft") {
        if (failure === "lettura" || init.method)
          return Response.json({ error: "Disco pieno" }, { status: 500 });
        if (failure === "scrittura") return new Response(null, { status: 404 });
        return Response.json({
          patientId: 1,
          plan: emptyWeekPlan(),
          updatedAt: "2026-11-25T10:00:00Z",
        });
      }
      return Response.json({ error: "Lettura interrotta" }, { status: 500 });
    });
    render(
      <ReportProvider>
        <App />
      </ReportProvider>,
    );
    const user = setup();
    if (failure === "scarto")
      await user.click(await screen.findByRole("button", { name: "Scarta" }));
    if (failure === "ripristino")
      await user.click(
        await screen.findByRole("button", { name: "Ripristina" }),
      );
    if (failure === "scrittura") {
      await user.click(screen.getByRole("radio", { name: "Schema" }));
      await user.click(
        screen.getByRole("radio", { name: "Piano settimanale" }),
      );
      const input = screen.getByRole("combobox", { name: /Cerca alimento/ });
      await user.type(input, "riso");
      const option = (await screen.findAllByRole("option"))[0];
      if (!option) throw new Error("Alimento non trovato");
      await user.click(option);
    }
    await reportError(
      failure === "ripristino"
        ? "Caricamento piano non riuscito: Lettura interrotta"
        : failure === "scrittura"
          ? "Bozza non scritta: Disco pieno"
          : "Disco pieno",
    );
  },
);

it("non offre la segnalazione quando Gaetanata si è chiusa", async () => {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/report") return technicalData();
    throw new TypeError("Failed to fetch");
  });
  render(
    <ReportProvider>
      <WindowGate>
        <p>Editor</p>
      </WindowGate>
    </ReportProvider>,
  );
  await screen.findByText(
    "Gaetanata si è chiusa. Riaprila dall'icona. Nessuna bozza scritta in questa finestra.",
  );
  expect(screen.queryByRole("button", { name: "Segnala problema" })).toBeNull();
});

it("segnala lo storico non aggiornato dopo un Word generato senza includere il nome del file", async () => {
  vi.useFakeTimers();
  let reads = 0;
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/report") return technicalData();
    if (path === "/api/template") return Response.json({ available: true });
    if (path.endsWith("/document"))
      return new Response("Word sintetico", {
        headers: {
          "content-disposition":
            "attachment; filename*=UTF-8''Persona%20Fittizia.docx",
        },
      });
    if (++reads === 1) return Response.json({ documents: [] });
    return Response.json({ error: "Disco pieno" }, { status: 500 });
  });
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:synthetic");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  try {
    await act(async () => {
      render(
        <ReportProvider>
          <SchemaWordPanel patientId={1} schemaDirty={false} />
        </ReportProvider>,
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Genera Word" }));
    });
    const message = screen.getByText("Storico non aggiornato: Disco pieno");
    await act(async () => {
      fireEvent.click(
        within(message).getByRole("button", { name: "Segnala problema" }),
      );
    });
    const body = screen.getByLabelText(
      "Anteprima della segnalazione",
    ).textContent;
    expect(body).toContain(
      "Errore di partenza: Storico non aggiornato: Disco pieno",
    );
    expect(body).not.toContain("Persona Fittizia");
  } finally {
    cleanup();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  }
});

it("non propone segnalazioni per le validazioni dello schema o del Word", async () => {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path === "/api/patients") return Response.json({ patients });
    if (path.endsWith("/plan")) return Response.json(emptyWeekPlan());
    if (path.endsWith("/schema")) return Response.json(emptySchema());
    if (path === "/api/template") return Response.json({ available: true });
    if (path.endsWith("/document"))
      return Response.json(
        {
          error:
            "Completa i dati prima di generare il Word: Inserisci le kcal dieta.",
          issues: [{ field: "kcal", message: "Inserisci le kcal dieta." }],
        },
        { status: 422 },
      );
    return Response.json({ documents: [] });
  });
  render(
    <ReportProvider>
      <App />
    </ReportProvider>,
  );
  const user = setup();
  await openSchema(user, "Prova Uno");
  await user.click(screen.getByRole("button", { name: "Genera Word" }));
  await screen.findByText("Completa i dati prima di generare il Word:");
  await user.clear(screen.getByLabelText("Carboidrati (%)"));
  await user.type(screen.getByLabelText("Carboidrati (%)"), "40");
  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findAllByText(
    "Salvataggio schema non riuscito: controlla le impostazioni segnalate nello schema.",
  );
  expect(
    screen.queryAllByRole("button", { name: "Segnala problema" }),
  ).toHaveLength(0);
});
