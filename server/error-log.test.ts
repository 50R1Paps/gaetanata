import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";
import { startServer } from "./app.ts";
import { buildSyntheticTemplate } from "./template-contract.ts";

it("records server exceptions without request data, but excludes validation errors", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-errors-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
    staticDir: join(dir, "missing-static"),
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("address");
    const base = `http://127.0.0.1:${address.port}`;
    expect(
      (await fetch(`${base}/api/patients`, { method: "POST", body: "{}" }))
        .status,
    ).toBe(400);
    expect(
      (
        await fetch(`${base}/failure?private=segreto`, {
          method: "POST",
          body: "nome fittizio riservato",
        })
      ).status,
    ).toBe(500);
    const text = readFileSync(join(dir, "errori.json"), "utf8");
    const entries = JSON.parse(text);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      origin: "server",
      message: expect.stringContaining("ENOENT"),
      date: expect.any(String),
      stack: expect.stringContaining("Error:"),
    });
    expect(Number.isNaN(Date.parse(entries[0].date))).toBe(false);
    expect(text).not.toMatch(/segreto|private|nome fittizio riservato/);
  } finally {
    server.close();
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  }
});

it("accepts interface errors even from inactive windows and retains only 50 across restarts", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-errors-"));
  const options = { port: 0, databaseFile: join(dir, "app.db") };
  let server = await startServer(options);
  const base = () => {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("address");
    return `http://127.0.0.1:${address.port}`;
  };
  try {
    expect(
      (await fetch(`${base()}/api/errors`, { method: "POST", body: "{}" }))
        .status,
    ).toBe(400);
    for (let index = 0; index < 52; index++) {
      const response = await fetch(`${base()}/api/errors?secret=riservato`, {
        method: "POST",
        body: JSON.stringify({
          message: `Errore ${index}`,
          stack:
            "Error\nframe1\nframe2\nframe3\nframe4\nframe5\nframe6\nframe7",
          patient: "nome fittizio riservato",
        }),
      });
      expect(response.status).toBe(204);
    }
    server.close();
    await once(server, "close");
    server = await startServer(options);
    expect((await fetch(`${base()}/api/health`)).status).toBe(200);
    const text = readFileSync(join(dir, "errori.json"), "utf8");
    const entries = JSON.parse(text);
    expect(entries).toHaveLength(50);
    expect(entries[0]).toMatchObject({
      origin: "interfaccia",
      message: "Errore 2",
    });
    expect(entries[49].message).toBe("Errore 51");
    expect(entries[49].stack).toBe(
      "Error\nframe1\nframe2\nframe3\nframe4\nframe5",
    );
    expect(text).not.toMatch(/riservato|secret|patient|frame6/);
  } finally {
    server.close();
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  }
});

it("records failed updates, including a rollback reported after restart", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-errors-"));
  const releases = createServer((req, res) => {
    if (req.url === "/archive") {
      res.writeHead(500).end();
      return;
    }
    const address = releases.address();
    if (!address || typeof address === "string") throw new Error("address");
    res.end(
      JSON.stringify({
        tag_name: "v99.0.0",
        body: "novità",
        zipball_url: `http://127.0.0.1:${address.port}/archive`,
      }),
    );
  });
  releases.listen(0, "127.0.0.1");
  await once(releases, "listening");
  const address = releases.address();
  if (!address || typeof address === "string") throw new Error("address");
  const options = { port: 0, databaseFile: join(dir, "app.db") };
  let server = await startServer({
    ...options,
    appDir: dir,
    onRestart: () => {},
    releaseSource: { apiUrl: `http://127.0.0.1:${address.port}`, gitUrl: dir },
  });
  try {
    const app = server.address();
    if (!app || typeof app === "string") throw new Error("address");
    const base = `http://127.0.0.1:${app.port}`;
    const presence = () =>
      fetch(`${base}/api/window`, {
        method: "POST",
        body: JSON.stringify({ windowId: "active" }),
      }).then((res) => res.json());
    await expect
      .poll(async () => (await presence()).update.status)
      .toBe("available");
    expect(
      (
        await fetch(`${base}/api/update`, {
          method: "POST",
          body: JSON.stringify({ windowId: "active" }),
        })
      ).status,
    ).toBe(202);
    await expect
      .poll(async () => (await presence()).update.status)
      .toBe("failed");
    let entries = JSON.parse(readFileSync(join(dir, "errori.json"), "utf8"));
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      origin: "aggiornamento",
      message: "Download ZIP non riuscito",
      stack: expect.stringContaining("install-update.ts"),
    });
    server.close();
    await once(server, "close");
    server = await startServer({ ...options, failedUpdateVersion: "0.1.0" });
    entries = JSON.parse(readFileSync(join(dir, "errori.json"), "utf8"));
    expect(entries).toHaveLength(2);
    expect(entries[1]).toMatchObject({
      origin: "aggiornamento",
      message: expect.stringContaining("0.1.0"),
    });
  } finally {
    server.close();
    releases.close();
    await Promise.all([once(server, "close"), once(releases, "close")]);
    rmSync(dir, { recursive: true, force: true });
  }
});

it("persists an unhandled server exception without preventing process failure", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-crash-"));
  try {
    const appUrl = new URL("./app.ts", import.meta.url).href;
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        `import { startServer } from ${JSON.stringify(appUrl)};\nawait startServer({ port: 0, databaseFile: ${JSON.stringify(join(dir, "app.db"))} });\nsetTimeout(() => { throw new Error("Eccezione sintetica non gestita"); }, 0);`,
      ],
      { stdio: "ignore" },
    );
    const [code] = await once(child, "exit");
    expect(code).not.toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "errori.json"), "utf8"))).toEqual([
      expect.objectContaining({
        origin: "server",
        message: "Eccezione sintetica non gestita",
        stack: expect.stringContaining("Timeout"),
      }),
    ]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000);

it.each(["plan", "schema", "draft", "document"])(
  "does not expose stored patient contents when decoding %s fails",
  async (kind) => {
    const dir = mkdtempSync(join(tmpdir(), "gaetanata-private-errors-"));
    const databaseFile = join(dir, "app.db");
    const server = await startServer({ port: 0, databaseFile });
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("address");
      const base = `http://127.0.0.1:${address.port}`;
      const patient = await (
        await fetch(`${base}/api/patients`, {
          method: "POST",
          body: JSON.stringify({ name: "Paziente Fittizio" }),
        })
      ).json();
      const db = new DatabaseSync(databaseFile);
      try {
        const privateText = "contenuto clinico fittizio riservato";
        if (kind === "plan")
          db.prepare(
            "INSERT INTO plans (patient_id, plan_json) VALUES (?, ?)",
          ).run(patient.id, privateText);
        else if (kind === "draft")
          db.prepare(
            "INSERT INTO draft (id, patient_id, updated_at, plan_json) VALUES (1, ?, ?, ?)",
          ).run(patient.id, new Date().toISOString(), privateText);
        else
          db.prepare(
            "INSERT INTO schemas (patient_id, schema_json) VALUES (?, ?)",
          ).run(patient.id, privateText);
      } finally {
        db.close();
      }
      if (kind === "document") {
        const template = buildSyntheticTemplate();
        expect(
          (
            await fetch(`${base}/api/template`, {
              method: "PUT",
              body: new Uint8Array(template),
            })
          ).status,
        ).toBe(200);
      }
      const path =
        kind === "draft" ? "/api/draft" : `/api/patients/${patient.id}/${kind}`;
      const response = await fetch(`${base}${path}`, {
        method: kind === "document" ? "POST" : "GET",
      });
      expect(response.status).toBe(500);
      expect(await response.text()).not.toContain("riservato");
      const text = readFileSync(join(dir, "errori.json"), "utf8");
      expect(text).not.toMatch(/contenuto|clinico|riservato|Paziente Fittizio/);
      expect(JSON.parse(text)[0]).toMatchObject({
        origin: "server",
        message: expect.stringContaining(String(patient.id)),
      });
    } finally {
      server.close();
      await once(server, "close");
      rmSync(dir, { recursive: true, force: true });
    }
  },
);

it("keeps serving requests when writing the registry fails", async () => {
  const dir = mkdtempSync(join(tmpdir(), "gaetanata-errors-unwritable-"));
  const server = await startServer({
    port: 0,
    databaseFile: join(dir, "app.db"),
  });
  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("address");
    const base = `http://127.0.0.1:${address.port}`;
    const blocked = join(dir, "errori.json.tmp");
    mkdirSync(blocked);
    const response = await fetch(`${base}/api/errors`, {
      method: "POST",
      body: JSON.stringify({ message: "Errore durante il blocco" }),
      signal: AbortSignal.timeout(1_000),
    });
    expect(response.status).toBe(204);
    expect((await fetch(`${base}/api/health`)).status).toBe(200);
    rmSync(blocked, { recursive: true });
    expect(
      (
        await fetch(`${base}/api/errors`, {
          method: "POST",
          body: JSON.stringify({ message: "Errore dopo il blocco" }),
        })
      ).status,
    ).toBe(204);
    expect(
      JSON.parse(readFileSync(join(dir, "errori.json"), "utf8")).map(
        (entry: { message: string }) => entry.message,
      ),
    ).toEqual(["Errore durante il blocco", "Errore dopo il blocco"]);
  } finally {
    server.closeAllConnections();
    server.close();
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  }
});
