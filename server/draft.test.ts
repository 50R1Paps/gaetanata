import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { addPortion, emptyWeekPlan } from "../src/plan.ts";
import { emptySchema } from "../src/schema.ts";
import { startServer } from "./app.ts";
import { migrations, openDatabase } from "./db.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

it("migrates saved documents, replaces one independent bozza, persists across restart and cascades patient deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-draft-"));
  const databaseFile = join(dir, "app.db");
  const previous = openDatabase(databaseFile, migrations.slice(0, 4));
  previous.prepare("INSERT INTO patients (name) VALUES (?)").run("Prova bozza");
  previous
    .prepare("INSERT INTO plans VALUES (?, ?)")
    .run(1, JSON.stringify(emptyWeekPlan()));
  previous
    .prepare("INSERT INTO schemas VALUES (?, ?)")
    .run(1, JSON.stringify(emptySchema()));
  previous.close();
  let server = await startServer({ port: 0, databaseFile });
  async function call(method: string, path = "/api/draft", body?: unknown) {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  }
  try {
    expect((await call("GET")).status).toBe(404);
    expect((await call("GET", "/api/patients")).body.patients).toMatchObject([
      { id: 1, name: "Prova bozza" },
    ]);
    const plan = addPortion(emptyWeekPlan(), 0, 0, {
      id: "synthetic",
      food: "Noci",
      grams: 30,
    });
    const before = Date.now();
    const written = await call("PUT", undefined, {
      patientId: 1,
      plan,
      schema: { ...emptySchema(), kcal: 1800 },
      updatedAt: "ignored",
    });
    expect(written.status).toBe(200);
    expect(written.body).toMatchObject({
      patientId: 1,
      plan,
      schema: { ...emptySchema(), kcal: 1800 },
    });
    expect(Date.parse(written.body.updatedAt)).toBeGreaterThanOrEqual(before);
    for (const invalid of [
      {},
      { patientId: null },
      { patientId: "1", plan },
      { patientId: null, plan: { days: [] } },
      {
        patientId: null,
        plan: {
          ...plan,
          days: [...plan.days.slice(0, 6), { included: true, meals: [] }],
        },
      },
      {
        patientId: null,
        plan: addPortion(emptyWeekPlan(), 0, 0, {
          id: "bad",
          food: "Noci",
          grams: -1,
        }),
      },
      { patientId: null, schema: null },
      { patientId: null, schema: { ...emptySchema(), settings: {} } },
      { patientId: null, plan, schema: {} },
    ]) {
      expect((await call("PUT", undefined, invalid)).status).toBe(400);
      expect((await call("GET")).body).toEqual(written.body);
    }
    expect(
      (await call("PUT", undefined, { patientId: 9999, plan })).status,
    ).toBe(404);
    expect((await call("GET")).body).toEqual(written.body);
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    expect((await call("GET")).body).toEqual(written.body);
    for (const [suffix, expected] of [
      ["plan", emptyWeekPlan()],
      ["schema", emptySchema()],
    ] as const)
      expect((await call("GET", `/api/patients/1/${suffix}`)).body).toEqual(
        expected,
      );
    expect(
      (await call("PUT", undefined, { patientId: null, plan })).status,
    ).toBe(200);
    expect((await call("GET")).body).toEqual({
      patientId: null,
      plan,
      updatedAt: expect.any(String),
    });
    expect((await call("DELETE")).status).toBe(204);
    expect((await call("GET")).status).toBe(404);
    expect((await call("GET", "/api/patients/1/plan")).body).toEqual(
      emptyWeekPlan(),
    );
    expect((await call("GET", "/api/patients/1/schema")).body).toEqual(
      emptySchema(),
    );
    await call("PUT", undefined, { patientId: 1, schema: emptySchema() });
    await call("DELETE", "/api/patients/1");
    expect((await call("GET")).status).toBe(404);
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
