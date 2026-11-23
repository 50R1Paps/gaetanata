// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { App } from "../App";
import type { GeneratedDocument } from "../documentsApi";
import { emptyWeekPlan } from "../plan";
import { type DietSchema, emptySchema } from "../schema";
import { openSchema, patients, setup, stubDialogs } from "./schemaTestKit";

// The real routes are tested over HTTP in server/documents.test.ts; here an
// in-memory stand-in answers them. Fake files only.
const missingTags = "Segnaposto mancanti o blocchi incompleti: data, saluto";
let schemas: Map<number, DietSchema>;
let template: boolean;
let history: Map<number, GeneratedDocument[]>;
let uploads: string[];
let blobs: Blob[];
let downloads: { name: string; blob: Blob | undefined }[];

const attachment = (name: string, content: string) =>
  new Response(content, {
    headers: {
      "content-disposition": `attachment; filename="schema.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
    },
  });

beforeEach(() => {
  schemas = new Map();
  template = false;
  history = new Map();
  uploads = [];
  blobs = [];
  downloads = [];
  vi.stubGlobal("fetch", async (path: string, init: RequestInit = {}) => {
    if (path === "/api/draft") return new Response(null, { status: 404 });
    if (path === "/api/patients") return Response.json({ patients });
    if (path === "/api/template") {
      if (init.method === "PUT") {
        const file = init.body as File;
        uploads.push(file.name);
        if (!file.name.startsWith("valido"))
          return Response.json({ error: missingTags }, { status: 422 });
        template = true;
      }
      return Response.json({ available: template });
    }
    const [, , , id, document, documentId] = path.split("/");
    const patientId = Number(id);
    const generated = history.get(patientId) ?? [];
    if (document === "plan") return Response.json(emptyWeekPlan());
    if (document === "document") {
      const schema = schemas.get(patientId);
      if (!template)
        return Response.json(
          { error: "Carica il template Word prima di generare il documento." },
          { status: 422 },
        );
      if (!schema?.kcal)
        return Response.json(
          {
            error:
              "Completa i dati prima di generare il Word: Inserisci le kcal dieta.",
            issues: [{ field: "kcal", message: "Inserisci le kcal dieta." }],
          },
          { status: 422 },
        );
      const name = `${patients[patientId - 1]?.name} 2026-11-21.docx`;
      history.set(patientId, [
        {
          id: generated.length + 10,
          date: "2026-11-21T12:04:00.000Z",
          filename: name,
        },
        ...generated,
      ]);
      return attachment(name, `kcal ${schema.kcal}`);
    }
    if (document === "documents") {
      if (!documentId) return Response.json({ documents: generated });
      const found = generated.find((entry) => entry.id === Number(documentId));
      return found
        ? attachment(found.filename, `storico ${found.id}`)
        : Response.json({ error: "Documento non trovato" }, { status: 404 });
    }
    if (init.method === "PUT")
      schemas.set(patientId, JSON.parse(String(init.body)));
    return Response.json(schemas.get(patientId) ?? emptySchema());
  });
  stubDialogs();
  // jsdom has no object URLs nor downloads: record what would be saved.
  URL.createObjectURL = (blob: Blob) => `blob:${blobs.push(blob) - 1}`;
  URL.revokeObjectURL = () => {};
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    const blob = blobs[Number(this.href.slice("blob:".length))];
    downloads.push({ name: this.download, blob });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const word = () =>
  within(screen.getByRole("region", { name: "Documento Word" }));
const generate = () => word().getByRole("button", { name: "Genera Word" });
const reason = () =>
  document.getElementById(generate().getAttribute("aria-describedby") ?? "")
    ?.textContent;
const docx = (name: string) => new File(["x"], name, { type: "" });

it("uploads or replaces the template and shows the missing placeholders", async () => {
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  await word().findByText("Template Word non caricato.");
  expect(generate().hasAttribute("disabled")).toBe(true);
  expect(reason()).toBe("Carica il template Word per generare il documento.");

  await user.upload(
    word().getByLabelText("File del template Word"),
    docx("vecchio.docx"),
  );
  expect((await word().findByRole("alert")).textContent).toBe(missingTags);
  expect(word().getByText("Template Word non caricato.")).toBeTruthy();

  await user.upload(
    word().getByLabelText("File del template Word"),
    docx("valido.docx"),
  );
  await word().findByText("Template Word caricato.");
  expect(word().queryByRole("alert")).toBeNull();
  expect(uploads).toEqual(["vecchio.docx", "valido.docx"]);
  expect(
    word().getByRole("button", { name: "Sostituisci template…" }),
  ).toBeTruthy();

  // A rejected replacement keeps the template already on the computer.
  await user.upload(
    word().getByLabelText("File del template Word"),
    docx("rotto.docx"),
  );
  expect((await word().findByRole("alert")).textContent).toBe(missingTags);
  expect(word().getByText("Template Word caricato.")).toBeTruthy();
});

it("generates only from a saved schema and lists what to complete", async () => {
  template = true;
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");
  await word().findByText("Template Word caricato.");
  expect(generate().hasAttribute("disabled")).toBe(false);

  await user.click(generate());
  const problem = await word().findByRole("alert");
  expect(problem.textContent).toContain(
    "Completa i dati prima di generare il Word",
  );
  expect(
    within(problem)
      .getAllByRole("listitem")
      .map((item) => item.textContent),
  ).toEqual(["Inserisci le kcal dieta."]);
  expect(downloads).toEqual([]);

  const kcal = screen.getByLabelText("Kcal dieta");
  await user.type(kcal, "1800");
  expect(generate().hasAttribute("disabled")).toBe(true);
  expect(reason()).toBe(
    "Salva lo schema prima di generare: il Word usa lo schema salvato.",
  );

  await user.click(screen.getByRole("button", { name: "Salva schema" }));
  await screen.findByText("Schema salvato.");
  expect(generate().hasAttribute("disabled")).toBe(false);
  await user.click(generate());
  await word().findByText("Word generato: Prova Uno 2026-11-21.docx.");
  expect(word().queryByRole("alert")).toBeNull();
  expect(downloads.map(({ name }) => name)).toEqual([
    "Prova Uno 2026-11-21.docx",
  ]);
  expect(await downloads[0]?.blob?.text()).toBe("kcal 1800");
});

it("lists the patient's generated Words newest first and downloads them again", async () => {
  template = true;
  schemas.set(1, { ...emptySchema(), kcal: 1800 });
  history.set(1, [
    {
      id: 2,
      date: "2026-10-03T12:30:00.000Z",
      filename: "Prova Uno 2026-10-03.docx",
    },
    {
      id: 1,
      date: "2026-09-01T11:05:00.000Z",
      filename: "Prova Uno 2026-09-01.docx",
    },
  ]);
  const user = setup();
  render(<App />);
  await openSchema(user, "Prova Uno");

  const storico = () => within(word().getByRole("list", { name: "Storico" }));
  const rows = () =>
    storico()
      .getAllByRole("listitem")
      .map((item) => item.textContent);
  await word().findByText("Prova Uno 2026-10-03.docx");
  // UTC instants shown in local time: midday keeps the date in any time zone.
  expect(rows()).toEqual([
    expect.stringMatching(
      /^03\/10\/2026, \d\d:30Prova Uno 2026-10-03\.docxScarica$/,
    ),
    expect.stringMatching(
      /^01\/09\/2026, \d\d:05Prova Uno 2026-09-01\.docxScarica$/,
    ),
  ]);
  const times = word()
    .getByRole("list", { name: "Storico" })
    .querySelectorAll("time");
  expect([...times].map((time) => time.dateTime)).toEqual([
    "2026-10-03T12:30:00.000Z",
    "2026-09-01T11:05:00.000Z",
  ]);

  await user.click(
    storico().getByRole("button", {
      name: "Scarica Prova Uno 2026-09-01.docx",
    }),
  );
  expect(downloads.map(({ name }) => name)).toEqual([
    "Prova Uno 2026-09-01.docx",
  ]);
  expect(await downloads[0]?.blob?.text()).toBe("storico 1");

  await user.click(generate());
  await word().findByText("Prova Uno 2026-11-21.docx");
  expect(rows()[0]).toMatch(
    /^21\/11\/2026, \d\d:04Prova Uno 2026-11-21\.docxScarica$/,
  );
  expect(rows()).toHaveLength(3);

  // Each patient has their own history.
  await openSchema(user, "Prova Due");
  await word().findByText("Nessun documento generato.");
  expect(word().queryByRole("list", { name: "Storico" })).toBeNull();
});
