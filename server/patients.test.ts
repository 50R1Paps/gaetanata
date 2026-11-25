import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import packageInfo from "../package.json" with { type: "json" };
import { startServer } from "./app.ts";
import { migrations } from "./db.ts";

// Fake, anonymous people only: the repository is public.
const ada = {
  name: "Paziente Prova Uno",
  birthDate: "1980-05-17",
  sex: "female",
  weightKg: 62.5,
  heightCm: 165,
};
const onlyName = {
  name: "Paziente Prova Due",
  birthDate: null,
  sex: null,
  weightKg: null,
  heightCm: null,
};

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function tempDatabase(): string {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-patients-"));
  cleanups.push(async () => rmSync(dir, { recursive: true, force: true }));
  return join(dir, "app.db");
}

async function stop(server: Server): Promise<void> {
  if (!server.listening) return;
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

/** Starts the app on a free port; returns a JSON client for its API. */
async function start(databaseFile = tempDatabase()) {
  const server = await startServer({ port: 0, databaseFile });
  cleanups.push(() => stop(server));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing server address");
  const base = `http://127.0.0.1:${address.port}`;
  async function call(method: string, path: string, body?: unknown) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body:
        body === undefined
          ? null
          : typeof body === "string"
            ? body
            : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: text ? JSON.parse(text) : null };
  }
  return { call, stop: () => stop(server), databaseFile };
}

describe("patient API", () => {
  it("creates a patient with only a name and lists it", async () => {
    const api = await start();
    expect(await api.call("GET", "/api/patients")).toEqual({
      status: 200,
      body: { patients: [] },
    });

    const created = await api.call("POST", "/api/patients", {
      name: "  Paziente Prova Due  ",
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: expect.any(Number), ...onlyName });

    expect((await api.call("GET", "/api/patients")).body).toEqual({
      patients: [created.body],
    });
  });

  it("reads, updates and deletes a patient by id", async () => {
    const api = await start();
    const { body: created } = await api.call("POST", "/api/patients", ada);
    expect(created).toEqual({ id: expect.any(Number), ...ada });
    const path = `/api/patients/${created.id}`;

    expect(await api.call("GET", path)).toEqual({ status: 200, body: created });

    const changes = { ...ada, weightKg: 60, birthDate: null };
    expect(await api.call("PUT", path, changes)).toEqual({
      status: 200,
      body: { id: created.id, ...changes },
    });
    expect((await api.call("GET", path)).body).toEqual({
      id: created.id,
      ...changes,
    });

    expect(await api.call("DELETE", path)).toEqual({ status: 204, body: null });
    expect(await api.call("GET", path)).toEqual({
      status: 404,
      body: { error: "Scheda paziente non trovata" },
    });
    expect((await api.call("GET", "/api/patients")).body).toEqual({
      patients: [],
    });
  });

  it("keeps two patients with the same name distinct", async () => {
    const api = await start();
    const first = (await api.call("POST", "/api/patients", ada)).body;
    const second = (
      await api.call("POST", "/api/patients", { ...ada, weightKg: 80 })
    ).body;
    expect(second.id).not.toBe(first.id);

    await api.call("PUT", `/api/patients/${second.id}`, {
      ...ada,
      weightKg: 81,
    });
    expect((await api.call("GET", `/api/patients/${first.id}`)).body).toEqual(
      first,
    );

    await api.call("DELETE", `/api/patients/${first.id}`);
    expect((await api.call("GET", "/api/patients")).body.patients).toEqual([
      { id: second.id, ...ada, weightKg: 81 },
    ]);
  });

  it("lists patients alphabetically, ignoring case", async () => {
    const api = await start();
    for (const name of ["paziente C", "Paziente A", "Paziente b"])
      await api.call("POST", "/api/patients", { name });
    const { body } = await api.call("GET", "/api/patients");
    expect(body.patients.map((p: { name: string }) => p.name)).toEqual([
      "Paziente A",
      "Paziente b",
      "paziente C",
    ]);
  });

  it("keeps patients after the app is restarted on the same database", async () => {
    const first = await start();
    const { body: created } = await first.call("POST", "/api/patients", ada);
    await first.stop();

    const reopened = await start(first.databaseFile);
    expect((await reopened.call("GET", "/api/patients")).body).toEqual({
      patients: [created],
    });
    expect((await reopened.call("GET", "/api/health")).body).toEqual({
      app: "gaetanata",
      schemaVersion: migrations.length,
      version: packageInfo.version,
    });
  });

  it("does not reuse the id of a deleted patient", async () => {
    const api = await start();
    const { body: deleted } = await api.call("POST", "/api/patients", ada);
    await api.call("DELETE", `/api/patients/${deleted.id}`);
    const { body: next } = await api.call("POST", "/api/patients", ada);
    expect(next.id).not.toBe(deleted.id);
  });

  it.each([
    ["an empty name", { ...ada, name: "   " }, { name: "Inserisci il nome." }],
    ["a missing name", { sex: "male" }, { name: "Inserisci il nome." }],
    [
      "a future birth date",
      { ...ada, birthDate: "2999-01-01" },
      { birthDate: "La data di nascita non può essere nel futuro." },
    ],
    [
      "an impossible birth date",
      { ...ada, birthDate: "2001-02-30" },
      { birthDate: "Data di nascita non valida." },
    ],
    [
      "an unknown sex",
      { ...ada, sex: "other" },
      { sex: "Sesso non valido: scegli maschio o femmina." },
    ],
    [
      "zero weight and negative height",
      { ...ada, weightKg: 0, heightCm: -170 },
      {
        weightKg: "Il peso deve essere maggiore di zero.",
        heightCm: "L'altezza deve essere maggiore di zero.",
      },
    ],
    [
      "non-numeric weight and height",
      { ...ada, weightKg: "abc", heightCm: "170" },
      {
        weightKg: "Il peso deve essere un numero.",
        heightCm: "L'altezza deve essere un numero.",
      },
    ],
  ])("rejects %s without saving anything", async (_, input, fields) => {
    const api = await start();
    const { body: existing } = await api.call("POST", "/api/patients", ada);

    expect(await api.call("POST", "/api/patients", input)).toEqual({
      status: 400,
      body: { error: "Dati non validi", fields },
    });
    expect(
      await api.call("PUT", `/api/patients/${existing.id}`, input),
    ).toEqual({ status: 400, body: { error: "Dati non validi", fields } });

    expect((await api.call("GET", "/api/patients")).body).toEqual({
      patients: [existing],
    });
  });

  it("rejects a body that is not a JSON object", async () => {
    const api = await start();
    for (const body of ["{not json", "[]", "null"])
      expect(await api.call("POST", "/api/patients", body)).toEqual({
        status: 400,
        body: { error: "Richiesta non valida" },
      });
    expect((await api.call("GET", "/api/patients")).body.patients).toEqual([]);
  });

  it("answers 404 for patients that do not exist", async () => {
    const api = await start();
    const notFound = {
      status: 404,
      body: { error: "Scheda paziente non trovata" },
    };
    for (const id of ["999", "abc", "1.5", "-1"]) {
      const path = `/api/patients/${id}`;
      expect(await api.call("GET", path)).toEqual(notFound);
      expect(await api.call("PUT", path, ada)).toEqual(notFound);
      expect(await api.call("DELETE", path)).toEqual(notFound);
    }
    expect((await api.call("GET", "/api/patients")).body.patients).toEqual([]);
  });
});
