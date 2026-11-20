import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { emptyWeekPlan } from "../src/plan.ts";
import { startServer } from "./app.ts";
import { migrations, openDatabase } from "./db.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

it("persists complete plans independently across restart and rejects invalid replacements", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-plans-"));
  const databaseFile = join(dir, "app.db");
  const previous = openDatabase(databaseFile, migrations.slice(0, 1));
  previous.exec("INSERT INTO patients (name) VALUES ('Prova precedente')");
  previous.close();
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
    expect((await call("GET", "/api/patients")).body.patients).toEqual([
      {
        id: 1,
        name: "Prova precedente",
        birthDate: null,
        sex: null,
        weightKg: null,
        heightCm: null,
      },
    ]);
    expect((await call("GET", "/api/health")).body.schemaVersion).toBe(3);
    const first = (await call("POST", "/api/patients", { name: "Prova 1" }))
      .body;
    const second = (await call("POST", "/api/patients", { name: "Prova 2" }))
      .body;
    const path = `/api/patients/${first.id}/plan`;
    expect((await call("GET", path)).body).toEqual(emptyWeekPlan());
    const plan = {
      days: Array.from({ length: 7 }, (_, day) => ({
        included: day % 2 === 0,
        meals: Array.from({ length: 6 }, (_, meal) => [
          {
            id: `${day}-${meal}-a`,
            food: "Alimento non più presente",
            grams: 12.5 + day,
          },
          { id: `${day}-${meal}-b`, food: "Altro alimento", grams: 0 },
        ]),
      })),
    };
    expect(await call("PUT", path, plan)).toEqual({ status: 200, body: plan });
    expect((await call("GET", `/api/patients/${second.id}/plan`)).body).toEqual(
      emptyWeekPlan(),
    );
    for (const invalid of [
      null,
      {},
      { days: [] },
      { ...plan, days: [{ ...plan.days[0], meals: [] }] },
      {
        days: plan.days.map((day) => ({
          ...day,
          meals: day.meals.map(() => [{ id: "x", food: "x", grams: -1 }]),
        })),
      },
      ...["12", null, true, -0.5].map((grams) => ({
        days: plan.days.map((day) => ({
          ...day,
          meals: day.meals.map(() => [{ id: "row", food: "Alimento", grams }]),
        })),
      })),
      ...["", null, 1].map((food) => ({
        days: plan.days.map((day) => ({
          ...day,
          meals: day.meals.map(() => [{ id: "row", food, grams: 12 }]),
        })),
      })),
      { days: plan.days.map((day) => ({ ...day, included: "true" })) },
    ]) {
      expect((await call("PUT", path, invalid)).status).toBe(400);
      expect((await call("GET", path)).body).toEqual(plan);
    }
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    expect((await call("GET", path)).body).toEqual(plan);
    const updated = emptyWeekPlan();
    expect((await call("PUT", path, updated)).body).toEqual(updated);
    expect((await call("GET", path)).body).toEqual(updated);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    await fetch(`http://127.0.0.1:${address.port}/api/patients/${first.id}`, {
      method: "DELETE",
    });
    for (const method of ["GET", "PUT"])
      expect(
        await call(method, path, method === "PUT" ? plan : undefined),
      ).toEqual({
        status: 404,
        body: { error: "Scheda paziente non trovata" },
      });
    const replacement = (
      await call("POST", "/api/patients", { name: "Prova 1" })
    ).body;
    expect(replacement.id).not.toBe(first.id);
    expect(
      (await call("GET", `/api/patients/${replacement.id}/plan`)).body,
    ).toEqual(emptyWeekPlan());
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
