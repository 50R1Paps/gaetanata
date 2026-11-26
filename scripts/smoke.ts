import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";
import { startServer } from "../server/app.ts";
import { buildSyntheticTemplate } from "../server/template-contract.ts";
import { emptySchema } from "../src/schema.ts";

const dir = await mkdtemp(join(tmpdir(), "gaetanata-smoke-"));
let server: Server | undefined;
try {
  server = await startServer({ port: 0, databaseFile: join(dir, "smoke.db") });
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const json = (path: string, method: string, body: unknown) =>
    fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
  const created = await json("/api/patients", "POST", {
    name: "Paziente sintetico",
    birthDate: "1990-01-01",
    sex: "female",
    weightKg: 60,
    heightCm: 165,
  });
  assert.equal(created.status, 201, await created.clone().text());
  const patient = await created.json();
  const saved = await json(`/api/patients/${patient.id}/schema`, "PUT", {
    ...emptySchema(),
    kcal: 1800,
    proteinWeek: { redMeatGrams: 100 },
  });
  assert.equal(saved.status, 200, await saved.text());
  const uploaded = await fetch(`${base}/api/template`, {
    method: "PUT",
    body: new Uint8Array(buildSyntheticTemplate()),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(uploaded.status, 200, await uploaded.text());
  const document = await fetch(`${base}/api/patients/${patient.id}/document`, {
    method: "POST",
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(document.status, 200, await document.clone().text());
  assert.match(
    document.headers.get("content-type") ?? "",
    /wordprocessingml.document/,
  );
  const bytes = Buffer.from(await document.arrayBuffer());
  assert.equal(bytes.subarray(0, 2).toString(), "PK");
  const zip = new PizZip(bytes);
  assert(zip.file("[Content_Types].xml"));
  assert.match(
    zip.file("word/document.xml")?.asText() ?? "",
    /Paziente sintetico/,
  );
  console.log("Smoke Node: OK (paziente, schema, template sintetico, Word). ");
} finally {
  try {
    if (server) {
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      server.close((error) => (error ? reject(error) : resolve()));
      server.closeAllConnections();
      await promise;
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
