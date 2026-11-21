import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import PizZip from "pizzip";
import { expect, it } from "vitest";
import { startServer } from "./app.ts";
import { buildSyntheticTemplate } from "./template-contract.ts";

it("rejects oversized known-length and chunked requests without changing saved data", async () => {
  const dir = mkdtempSync(join(tmpdir(), "request-limits-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const patient = await (
      await fetch(`${base}/api/patients`, {
        method: "POST",
        body: JSON.stringify({ name: "Esempio" }),
      })
    ).json();
    for (const [path, method, size] of [
      ["/api/template", "PUT", 10 * 1024 * 1024],
      ["/api/patients", "POST", 1024 * 1024],
      [`/api/patients/${patient.id}`, "PUT", 1024 * 1024],
      [`/api/patients/${patient.id}/schema`, "PUT", 1024 * 1024],
      [`/api/patients/${patient.id}/plan`, "PUT", 1024 * 1024],
    ] as const) {
      const response = await fetch(base + path, {
        method,
        body: new Uint8Array(size + 1),
      });
      expect(response.status).toBe(413);
      expect((await response.json()).error).toContain("grande");
      const { promise, resolve, reject } = Promise.withResolvers<number>();
      const req = request(base + path, { method }, (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      });
      req.on("error", reject);
      for (let sent = 0; sent <= size; sent += 65536)
        req.write(Buffer.alloc(65536));
      req.end();
      expect(await promise).toBe(413);
    }
    expect(
      (await (await fetch(`${base}/api/patients/${patient.id}`)).json()).name,
    ).toBe("Esempio");
    expect(await (await fetch(`${base}/api/template`)).json()).toEqual({
      available: false,
    });
  } finally {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.close((error) => (error ? reject(error) : resolve()));
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects ZIP bombs, including forged expanded sizes, and preserves the previous template", async () => {
  const dir = mkdtempSync(join(tmpdir(), "zip-limits-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const url = `http://127.0.0.1:${address.port}/api/template`;
  const upload = (bytes: Buffer) =>
    fetch(url, { method: "PUT", body: new Uint8Array(bytes) });
  try {
    expect((await upload(buildSyntheticTemplate())).status).toBe(200);
    const zip = new PizZip(buildSyntheticTemplate());
    // Each entry fits individually, but their total expansion exceeds 40 MiB.
    zip.file("large-a.bin", Buffer.alloc(21 * 1024 * 1024));
    zip.file("large-b.bin", Buffer.alloc(21 * 1024 * 1024));
    const bomb = zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
    expect((await upload(bomb)).status).toBe(422);
    for (let offset = 0; offset < bomb.length - 46; offset++) {
      if (bomb.readUInt32LE(offset) === 0x02014b50)
        bomb.writeUInt32LE(1, offset + 24);
    }
    expect((await upload(bomb)).status).toBe(422);
    expect(await (await fetch(url)).json()).toEqual({ available: true });
    expect((await upload(buildSyntheticTemplate())).status).toBe(200);
  } finally {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.close((error) => (error ? reject(error) : resolve()));
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});
