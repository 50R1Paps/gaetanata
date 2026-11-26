import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import {
  emptySchema,
  schemaDays,
  schemaProteinSources,
} from "../src/schema.ts";
import { startServer } from "./app.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

it("persists optional input sections across restart, rejects invalid sections atomically and still accepts original v1", async () => {
  const dir = mkdtempSync(join(tmpdir(), "schema-sections-"));
  const databaseFile = join(dir, "app.db");
  let server = await startServer({ port: 0, databaseFile });
  async function call(method: string, path: string, body?: unknown) {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      body: body === undefined ? null : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const patient = (await call("POST", "/api/patients", { name: "Esempio" }))
      .body;
    const path = `/api/patients/${patient.id}/schema`;
    const original = { ...emptySchema(), kcal: 1800 };
    expect((await call("PUT", path, original)).body).toEqual(original);
    const schema = {
      ...original,
      proteinWeek: {
        redMeatGrams: 115,
        days: Object.fromEntries(
          schemaDays.map((day, index) => [
            day,
            {
              lunch: { source: schemaProteinSources[index], grams: 123 },
              dinner: { source: "uova", exception: true },
            },
          ]),
        ),
      },
      pizza: { breadGrams: 65, oilMl: 0, whiteMeatGrams: 0, fishGrams: 190 },
      breakfast: { choice: "yogurt", quantity: 170 },
      snacks: { nutsGrams: 30, yogurtGrams: 200 },
    };
    expect(await call("PUT", path, schema)).toEqual({
      status: 200,
      body: schema,
    });
    for (const section of [
      { proteinWeek: null },
      { proteinWeek: [] },
      { proteinWeek: { redMeatGrams: -1 } },
      { proteinWeek: { days: { monday: {} } } },
      { proteinWeek: { days: { lunedi: { breakfast: {} } } } },
      ...[
        null,
        {},
        { source: "pizza" },
        { source: "uova", grams: "120" },
        { source: "uova", grams: -1 },
        { source: "pesce", exception: true },
        { source: "uova", exception: 1 },
        { source: "uova", calculated: 120 },
      ].map((choice) => ({
        proteinWeek: { days: { lunedi: { lunch: choice } } },
      })),
      { pizza: null },
      { pizza: { day: "mai" } },
      { pizza: { enabled: false } },
      { pizza: { breadGrams: -1 } },
      { pizza: { oilMl: "10" } },
      { pizza: { whiteMeatGrams: -1 } },
      { pizza: { fishGrams: "150" } },
      { breakfast: null },
      { breakfast: { choice: "succo" } },
      { breakfast: { quantity: -1 } },
      { breakfast: { quantity: "125" } },
      { snacks: null },
      { snacks: { nutsGrams: -1 } },
      { snacks: { yogurtGrams: "125" } },
      { snacks: { extra: 10 } },
    ]) {
      expect((await call("PUT", path, { ...schema, ...section })).status).toBe(
        400,
      );
      expect((await call("GET", path)).body).toEqual(schema);
    }
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    expect((await call("GET", path)).body).toEqual(schema);
    for (const sections of [
      { proteinWeek: {}, pizza: {}, breakfast: {}, snacks: {} },
      {},
    ]) {
      const inputs = { ...original, ...sections };
      expect((await call("PUT", path, inputs)).body).toEqual(inputs);
      expect((await call("GET", path)).body).toEqual(inputs);
    }
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
