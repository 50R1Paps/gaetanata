import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { expect, it } from "vitest";
import { emptySchema } from "../src/schema.ts";
import { startServer } from "./app.ts";

it("renews the sole active window and transfers ownership only after close or stale presence without stopping the server", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-windows-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    idleGraceMs: 20,
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

it("writes the closing bozza before transfer, rejects inactive writes and waits for explicit closure before onIdle", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-idle-"));
  let idle = 0;
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    windowStaleAfterMs: 40,
    idleGraceMs: 80,
    onIdle: () => {
      idle += 1;
    },
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, body: unknown, method = "POST") =>
    fetch(`${base}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    await call("/api/window", { windowId: "first" });
    await call("/api/window", { windowId: "second" });
    for (const method of ["PUT", "DELETE"]) {
      expect(
        (await call("/api/draft", { windowId: "second" }, method)).status,
      ).toBe(409);
      expect((await call("/api/draft", {}, method)).status).toBe(409);
    }
    const draft = { patientId: null, schema: { ...emptySchema(), kcal: 1750 } };
    expect(
      (await call("/api/window/close", { windowId: "second", draft })).status,
    ).toBe(409);
    expect(
      (await call("/api/window/close", { windowId: "first", draft })).status,
    ).toBe(200);
    expect(await (await fetch(`${base}/api/draft`)).json()).toMatchObject(
      draft,
    );
    await delay(100);
    expect(idle).toBe(0); // A registered waiting window still exists.
    expect(
      await (await call("/api/window", { windowId: "second" })).json(),
    ).toEqual({ active: true });
    for (const method of ["PUT", "DELETE"]) {
      expect(
        (
          await call(
            "/api/draft",
            {
              windowId: "first",
              patientId: null,
              schema: { ...emptySchema(), kcal: 1900 },
            },
            method,
          )
        ).status,
      ).toBe(409);
      expect(await (await fetch(`${base}/api/draft`)).json()).toMatchObject(
        draft,
      );
    }
    await delay(100);
    expect(idle).toBe(0); // Missing presence never shuts down.
    await call("/api/window", { windowId: "second" });
    expect(
      (
        await call("/api/window/close", {
          windowId: "second",
          draft: { patientId: null },
        })
      ).status,
    ).toBe(400);
    expect(
      (await call("/api/draft", { windowId: "second", ...draft }, "PUT"))
        .status,
    ).toBe(200);
    await call("/api/window/close", { windowId: "second", draft: null });
    expect((await fetch(`${base}/api/draft`)).status).toBe(404);
    await delay(20);
    expect(idle).toBe(0);
    await call("/api/window", { windowId: "reload" });
    await delay(100);
    expect(idle).toBe(0);
    await call("/api/window", { windowId: "reload" });
    await call("/api/window/close", { windowId: "reload" });
    await delay(110);
    expect(idle).toBe(1);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  } finally {
    const { promise, resolve } = Promise.withResolvers<void>();
    server.close(() => resolve());
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});

it("stops after the reopened window closes even when the previous browser crashed", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-crash-"));
  let idle = 0;
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    windowStaleAfterMs: 60,
    idleGraceMs: 40,
    onIdle: () => {
      idle += 1;
    },
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  async function presence(windowId: string, close = false) {
    const response = await fetch(`${base}/api/window${close ? "/close" : ""}`, {
      method: "POST",
      body: JSON.stringify({ windowId }),
    });
    return response.json();
  }
  try {
    expect(await presence("crashed")).toEqual({ active: true });
    await delay(100);
    expect(idle).toBe(0);
    expect(await presence("reopened")).toEqual({ active: true });
    await presence("reopened", true);
    await delay(70);
    expect(idle).toBe(1);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
  } finally {
    const { promise, resolve } = Promise.withResolvers<void>();
    server.close(() => resolve());
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});

it("writes a sleeping owner's closing bozza and starts shutdown after freeing its slot", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-sleep-close-"));
  let idle = 0;
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    windowStaleAfterMs: 30,
    idleGraceMs: 30,
    onIdle: () => { idle += 1; },
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, body: unknown) => fetch(`${base}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  try {
    await call("/api/window", { windowId: "sleeping" });
    await delay(60);
    const draft = { patientId: null, schema: { ...emptySchema(), kcal: 1800 } };
    expect((await call("/api/window/close", { windowId: "sleeping", draft })).status).toBe(200);
    expect(await (await fetch(`${base}/api/draft`)).json()).toMatchObject(draft);
    await delay(60);
    expect(idle).toBe(1);
    expect(await (await call("/api/window", { windowId: "next" })).json()).toEqual({ active: true });
  } finally {
    const { promise, resolve } = Promise.withResolvers<void>();
    server.close(() => resolve());
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});

it("never starts shutdown when a waiting window closes while the owner sleeps", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-waiting-close-"));
  let idle = 0;
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    windowStaleAfterMs: 30,
    idleGraceMs: 30,
    onIdle: () => { idle += 1; },
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No address");
  const base = `http://127.0.0.1:${address.port}`;
  const call = (path: string, windowId: string) => fetch(`${base}${path}`, {
    method: "POST",
    body: JSON.stringify({ windowId }),
  });
  try {
    await call("/api/window", "sleeping");
    expect(await (await call("/api/window", "waiting")).json()).toEqual({ active: false });
    await delay(60);
    await call("/api/window/close", "waiting");
    await delay(60);
    expect(idle).toBe(0);
    expect(await (await call("/api/window", "sleeping")).json()).toEqual({ active: true });
  } finally {
    const { promise, resolve } = Promise.withResolvers<void>();
    server.close(() => resolve());
    await promise;
    rmSync(dir, { recursive: true, force: true });
  }
});
