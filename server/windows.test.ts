import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { startServer } from "./app.ts";

it("renews the sole active window and transfers ownership only after close or stale presence without stopping the server", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-windows-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    windowStaleAfterMs: 100,
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  async function presence(windowId: string, close = false) {
    const response = await fetch(`${base}/api/window${close ? "/close" : ""}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ windowId }),
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    for (const path of ["/api/window", "/api/window/close"]) {
      expect((await fetch(`${base}${path}`)).status).toBe(405);
      for (const body of [
        "{",
        "null",
        "{}",
        '{"windowId":42}',
        '{"windowId":" "}',
      ]) {
        expect(
          (await fetch(`${base}${path}`, { method: "POST", body })).status,
        ).toBe(400);
      }
    }
    expect(await presence("first")).toEqual({
      status: 200,
      body: { active: true },
    });
    expect(await presence("second")).toEqual({
      status: 200,
      body: { active: false },
    });
    await delay(60);
    expect((await presence("first")).body.active).toBe(true);
    await delay(60);
    expect((await presence("second")).body.active).toBe(false);
    await presence("second", true);
    expect((await presence("first")).body.active).toBe(true);
    await presence("first", true);
    expect((await presence("second")).body.active).toBe(true);
    await delay(120);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
    expect((await presence("third")).body.active).toBe(true);
    expect((await presence("second")).body.active).toBe(false);
  } finally {
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    server.close((error) => (error ? reject(error) : resolve()));
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});
