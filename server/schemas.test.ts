import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { emptySchema } from "../src/schema.ts";
import { startServer } from "./app.ts";
import { migrations, openDatabase } from "./db.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}
it("migrates existing patients/plans, saves isolated schema inputs across restart and cascades deletion", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-schema-"));
  const databaseFile = join(dir, "app.db");
  const previous = openDatabase(databaseFile, migrations.slice(0, 2));
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
    return {
      status: response.status,
      body: response.status === 204 ? null : await response.json(),
    };
  }
  const path = "/api/patients/1/schema";
  try {
    expect((await call("GET", "/api/patients/1")).body.name).toBe(
      "Prova precedente",
    );
    expect(await call("GET", path)).toEqual({
      status: 200,
      body: emptySchema(),
    });
    const second = (
      await call("POST", "/api/patients", { name: "Prova seconda" })
    ).body;
    const schema = {
      ...emptySchema(),
      kcal: 1800,
      laf: 1.7,
      mealCount: 4,
      macroPercent: { carbohydrates: 40, fat: 35, protein: 25 },
      overrides: {
        meals: { breakfast: { fat: 0 } },
        carbohydrates: { lunch: { pasta: 87.5 } },
      },
    };
    expect(await call("PUT", path, schema)).toEqual({
      status: 200,
      body: schema,
    });
    expect(
      (await call("GET", `/api/patients/${second.id}/schema`)).body,
    ).toEqual(emptySchema());
    for (const invalid of [
      null,
      {},
      [],
      { ...schema, version: 2 },
      { ...schema, kcal: 0 },
      { ...schema, laf: -1 },
      ...[2, 7, "4", 4.5].map((mealCount) => ({ ...schema, mealCount })),
      { ...schema, macroPercent: { carbohydrates: 50, fat: 30, protein: 30 } },
      { ...schema, overrides: { meals: { breakfast: { fat: -1 } } } },
      { ...schema, overrides: { meals: { unknown: { protein: 10 } } } },
      { ...schema, overrides: { carbohydrates: { lunch: { pasta: "80" } } } },
      { ...schema, computed: { fabbisogno: 2000 } },
    ]) {
      expect((await call("PUT", path, invalid)).status).toBe(400);
      expect((await call("GET", path)).body).toEqual(schema);
    }
    expect((await call("POST", path, schema)).status).toBe(405);
    expect((await call("GET", "/api/patients/999/schema")).status).toBe(404);
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    expect((await call("GET", path)).body).toEqual(schema);
    expect((await call("PUT", path, emptySchema())).body).toEqual(
      emptySchema(),
    );
    await call("DELETE", "/api/patients/1");
    expect((await call("GET", path)).status).toBe(404);
    expect((await call("PUT", path, schema)).status).toBe(404);
    // A second start proves foreign-key cleanup: no orphan remains on disk.
    await stop(server);
    const db = openDatabase(databaseFile);
    try {
      expect(db.prepare("SELECT COUNT(*) AS count FROM schemas").get()).toEqual(
        { count: 0 },
      );
    } finally {
      db.close();
    }
    server = await startServer({ port: 0, databaseFile });
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
