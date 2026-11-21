import { mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { emptySchema } from "../src/schema.ts";
import { startServer } from "./app.ts";
import { buildSyntheticTemplate } from "./template-contract.ts";

async function stop(server: Server) {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.close((error) => (error ? reject(error) : resolve()));
  await promise;
}

it("keeps generated documents immutable, newest first and scoped to their patient across restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-history-"));
  const databaseFile = join(dir, "app.db");
  let server = await startServer({ port: 0, databaseFile });
  const call = (path: string, method = "GET", body?: unknown) => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    return fetch(`http://127.0.0.1:${address.port}${path}`, {
      method,
      body: body === undefined ? null : JSON.stringify(body),
    });
  };
  try {
    const patient = await (
      await call("/api/patients", "POST", {
        name: "Prova Anònima",
        birthDate: "1990-01-01",
        sex: "female",
        weightKg: 60,
        heightCm: 165,
      })
    ).json();
    const base = `/api/patients/${patient.id}`;
    expect(await (await call(`${base}/documents`)).json()).toEqual({
      documents: [],
    });
    expect((await call(`${base}/document`, "POST")).status).toBe(422);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No address");
    await fetch(`http://127.0.0.1:${address.port}/api/template`, {
      method: "PUT",
      body: new Uint8Array(buildSyntheticTemplate()),
    });
    await call(`${base}/schema`, "PUT", { ...emptySchema(), kcal: 1800 });
    const generated = await call(`${base}/document`, "POST");
    expect(generated.status).toBe(200);
    const bytes = Buffer.from(await generated.arrayBuffer());
    const disposition = generated.headers.get("content-disposition");
    const first = (await (await call(`${base}/documents`)).json()).documents;
    expect(first).toEqual([
      {
        id: expect.any(Number),
        date: expect.any(String),
        filename: expect.stringContaining("Prova Anònima"),
      },
    ]);
    expect(new Date(first[0].date).toISOString()).toBe(first[0].date);
    await call(`${base}/schema`, "PUT", { ...emptySchema(), kcal: 2200 });
    expect((await call(`${base}/document`, "POST")).status).toBe(200);
    await stop(server);
    server = await startServer({ port: 0, databaseFile });
    const entries = (await (await call(`${base}/documents`)).json()).documents;
    expect(entries).toHaveLength(2);
    expect(entries[1]).toEqual(first[0]);
    expect(entries[0].id).toBeGreaterThan(entries[1].id);
    expect(entries[0].date >= entries[1].date).toBe(true);
    const download = await call(`${base}/documents/${first[0].id}`);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-disposition")).toBe(disposition);
    expect(download.headers.get("content-type")).toContain(
      "wordprocessingml.document",
    );
    expect(Buffer.from(await download.arrayBuffer())).toEqual(bytes);
    const other = await (
      await call("/api/patients", "POST", { name: "Altro" })
    ).json();
    expect(
      (await call(`/api/patients/${other.id}/documents/${first[0].id}`)).status,
    ).toBe(404);
    expect((await call(`${base}/documents/999999`)).status).toBe(404);
    expect((await call(`${base}/documents`, "POST")).status).toBe(405);
    expect(
      (await call(`${base}/documents/${first[0].id}`, "DELETE")).status,
    ).toBe(405);
    expect((await call(`${base}`, "DELETE")).status).toBe(204);
    expect((await call(`${base}/documents`)).status).toBe(404);
    expect((await call(`${base}/documents/${first[0].id}`)).status).toBe(404);
  } finally {
    await stop(server);
    rmSync(dir, { recursive: true, force: true });
  }
});
