import { execFileSync } from "node:child_process";
import { once } from "node:events";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createServer, request, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import PizZip from "pizzip";
import { expect, it } from "vitest";
import { startServer } from "./app.ts";

it("refuses a modified clone without changing tracked files", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-update-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: root });
  git("init");
  git("config", "user.email", "test@example.invalid");
  git("config", "user.name", "Test");
  writeFileSync(join(root, "tracked"), "original");
  git("add", "tracked");
  git("commit", "-m", "initial");
  writeFileSync(join(root, "tracked"), "modified");
  const releases = createServer((_req, res) => {
    res.end(JSON.stringify({ tag_name: "v99.0.0", body: "novità" }));
  });
  releases.listen(0, "127.0.0.1");
  await once(releases, "listening");
  const address = releases.address();
  if (!address || typeof address === "string") throw new Error("address");
  const server = await startServer({
    port: 0,
    databaseFile: join(root, "data", "gaetanata.db"),
    appDir: root,
    onRestart: () => {},
    releaseSource: { apiUrl: `http://127.0.0.1:${address.port}`, gitUrl: root },
  });
  try {
    const app = server.address();
    if (!app || typeof app === "string") throw new Error("address");
    const base = `http://127.0.0.1:${app.port}`;
    const presence = () =>
      fetch(`${base}/api/window`, {
        method: "POST",
        body: JSON.stringify({ windowId: "active" }),
      }).then((response) => response.json());
    await expect
      .poll(async () => (await presence()).update.status)
      .toBe("available");
    const result = await fetch(`${base}/api/update`, {
      method: "POST",
      body: JSON.stringify({ windowId: "active" }),
    });
    expect(result.status).toBe(409);
    expect((await result.json()).error).toMatch(/contatta chi ti aiuta/i);
    expect(
      git("status", "--porcelain", "--untracked-files=no").toString(),
    ).toContain("tracked");
  } finally {
    server.close();
    releases.close();
    await Promise.all([once(server, "close"), once(releases, "close")]);
    rmSync(root, { recursive: true, force: true });
  }
}, 15_000);

it("rejects writes admitted before the update and all new writes during the freeze", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-barrier-"));
  const download = Promise.withResolvers<ServerResponse>();
  let installing = false;
  const releases = createServer((req, res) => {
    if (req.url === "/archive") {
      download.resolve(res);
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
  const server = await startServer({
    port: 0,
    databaseFile: join(root, "data", "gaetanata.db"),
    appDir: root,
    onRestart: () => {},
    releaseSource: { apiUrl: `http://127.0.0.1:${address.port}`, gitUrl: root },
  });
  const app = server.address();
  if (!app || typeof app === "string") throw new Error("address");
  const base = `http://127.0.0.1:${app.port}`;
  const presence = () =>
    fetch(`${base}/api/window`, {
      method: "POST",
      body: JSON.stringify({ windowId: "active" }),
    }).then((response) => response.json());
  try {
    await expect
      .poll(async () => (await presence()).update.status)
      .toBe("available");
    const admitted = Promise.withResolvers<void>();
    server.on("request", (req) => {
      if (req.url === "/api/draft" && req.method === "DELETE")
        admitted.resolve();
    });
    const pending = request(`${base}/api/draft`, {
      method: "DELETE",
      headers: { "transfer-encoding": "chunked" },
    });
    pending.write('{"windowId":');
    await admitted.promise;
    const started = await fetch(`${base}/api/update`, {
      method: "POST",
      body: JSON.stringify({ windowId: "active" }),
    });
    installing = started.status === 202;
    expect(started.status).toBe(202);
    const response = once(pending, "response");
    pending.end('"active"}');
    const [late] = await response;
    expect(late.statusCode).toBe(409);
    late.resume();
    for (const path of [
      "/api/patients",
      "/api/patients/1/plan",
      "/api/patients/1/schema",
      "/api/draft",
    ]) {
      const result = await fetch(`${base}${path}`, {
        method: "PUT",
        body: "{}",
      });
      expect(result.status).toBe(409);
    }
  } finally {
    if (installing) {
      // Finish the held download and await rollback before deleting its data.
      const archive = new PizZip();
      archive.file(
        "release/package.json",
        JSON.stringify({ version: "0.0.0" }),
      );
      (await download.promise).end(archive.generate({ type: "nodebuffer" }));
      await expect
        .poll(async () => (await presence()).update.status)
        .toBe("failed");
      await expect
        .poll(() => existsSync(join(root, ".aggiornamento", "nuova")))
        .toBe(false);
    }
    server.closeAllConnections();
    releases.closeAllConnections();
    server.close();
    releases.close();
    await Promise.all([once(server, "close"), once(releases, "close")]);
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);

it("restores ZIP files when the archive has the wrong version", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-zip-"));
  writeFileSync(join(root, "tracked"), "original");
  const zip = new PizZip();
  zip.file("release/package.json", JSON.stringify({ version: "0.3.0" }));
  zip.file("release/tracked", "new");
  const archive = zip.generate({ type: "nodebuffer" });
  const releases = createServer((req, res) => {
    if (req.url === "/archive") res.end(archive);
    else
      res.end(
        JSON.stringify({
          tag_name: "v0.2.0",
          body: "",
          zipball_url: `http://${req.headers.host}/archive`,
        }),
      );
  });
  releases.listen(0, "127.0.0.1");
  await once(releases, "listening");
  const address = releases.address();
  if (!address || typeof address === "string") throw new Error("address");
  const server = await startServer({
    port: 0,
    databaseFile: join(root, "data", "gaetanata.db"),
    appDir: root,
    onRestart: () => {},
    releaseSource: { apiUrl: `http://127.0.0.1:${address.port}`, gitUrl: root },
  });
  try {
    const app = server.address();
    if (!app || typeof app === "string") throw new Error("address");
    const base = `http://127.0.0.1:${app.port}`;
    const post = (path: string) =>
      fetch(`${base}${path}`, {
        method: "POST",
        body: JSON.stringify({ windowId: "active" }),
      });
    const presence = async () =>
      (await (await post("/api/window")).json()).update;
    await expect.poll(async () => (await presence()).status).toBe("available");
    expect((await post("/api/update")).status).toBe(202);
    await expect.poll(async () => (await presence()).status).toBe("failed");
    await expect
      .poll(() => existsSync(join(root, ".aggiornamento", "nuova")))
      .toBe(false);
    expect(readFileSync(join(root, "tracked"), "utf8")).toBe("original");
    expect(existsSync(join(root, "package.json"))).toBe(false);
  } finally {
    server.close();
    releases.close();
    await Promise.all([once(server, "close"), once(releases, "close")]);
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

it.each([
  { nodeVersion: "22.13.0", nodeCompleto: false },
  { nodeVersion: "22.12.9", nodeCompleto: true },
])(
  "updates a clean local clone with Node $nodeVersion",
  async ({ nodeVersion, nodeCompleto }) => {
    const root = mkdtempSync(join(tmpdir(), "gaetanata-update-"));
    const source = join(root, "source");
    const clone = join(root, "clone");
    const fakeVite = join(root, "fake-vite");
    mkdirSync(source);
    mkdirSync(fakeVite);
    writeFileSync(
      join(fakeVite, "package.json"),
      JSON.stringify({ name: "vite", version: "1.0.0" }),
    );
    mkdirSync(join(fakeVite, "bin"));
    writeFileSync(
      join(fakeVite, "bin", "vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
    git(source, "init");
    git(source, "config", "user.email", "test@example.invalid");
    git(source, "config", "user.name", "Test");
    writeFileSync(
      join(source, ".gitignore"),
      "/node_modules/\n/dist/\n/data/\n/.aggiornamento/\n",
    );
    mkdirSync(join(source, "src"));
    writeFileSync(join(source, "src", "index.ts"), "");
    writeFileSync(join(source, "index.html"), "");
    writeFileSync(join(source, "vite.config.ts"), "");
    const writeVersion = (version: string) => {
      writeFileSync(
        join(source, "package.json"),
        JSON.stringify({
          name: "fixture",
          version,
          engines: { node: ">=22.13.0" },
          dependencies: { vite: "file:../fake-vite" },
        }),
      );
      const bin = dirname(process.execPath);
      const npm = [
        join(bin, "node_modules", "npm", "bin", "npm-cli.js"),
        join(bin, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
      ].find(existsSync);
      if (!npm) throw new Error("npm not found");
      execFileSync(
        process.execPath,
        [
          npm,
          "install",
          "--package-lock-only",
          "--ignore-scripts",
          "--offline",
          "--no-audit",
          "--no-fund",
        ],
        { cwd: source },
      );
    };
    writeVersion("0.1.0");
    git(source, "add", ".");
    git(source, "commit", "-m", "first");
    git(source, "tag", "v0.1.0");
    git(root, "clone", source, clone);
    const previousRef = git(clone, "symbolic-ref", "--short", "HEAD");
    writeVersion("0.2.0");
    git(source, "add", ".");
    git(source, "commit", "-m", "second");
    git(source, "tag", "v0.2.0");
    mkdirSync(join(clone, "node_modules"));
    mkdirSync(join(clone, "dist"));
    writeFileSync(join(clone, "node_modules", "old"), "previous dependencies");
    writeFileSync(join(clone, "dist", "old"), "previous build");
    const releases = createServer((_req, res) =>
      res.end(JSON.stringify({ tag_name: "v0.2.0", body: "novità" })),
    );
    releases.listen(0, "127.0.0.1");
    await once(releases, "listening");
    const address = releases.address();
    if (!address || typeof address === "string") throw new Error("address");
    const restarted = Promise.withResolvers<void>();
    let idle = false;
    const databaseFile = join(clone, "data", "gaetanata.db");
    const server = await startServer({
      port: 0,
      databaseFile,
      appDir: clone,
      nodeVersion,
      idleGraceMs: 20,
      onIdle: () => {
        idle = true;
      },
      onRestart: restarted.resolve,
      releaseSource: {
        apiUrl: `http://127.0.0.1:${address.port}`,
        gitUrl: source,
      },
    });
    try {
      const app = server.address();
      if (!app || typeof app === "string") throw new Error("address");
      const base = `http://127.0.0.1:${app.port}`;
      const post = (path: string, windowId: string) =>
        fetch(`${base}${path}`, {
          method: "POST",
          body: JSON.stringify({ windowId }),
        });
      const presence = async (windowId: string) =>
        (await post("/api/window", windowId)).json();
      await expect
        .poll(async () => (await presence("active")).update.status)
        .toBe("available");
      await presence("waiting");
      expect((await post("/api/update", "waiting")).status).toBe(409);
      writeFileSync(
        join(clone, "data", "prima-di-aggiornamento.db"),
        "old backup",
      );
      const db = new DatabaseSync(databaseFile);
      db.exec(
        "CREATE TABLE test_snapshot (value TEXT); INSERT INTO test_snapshot VALUES ('WAL content')",
      );
      db.close();
      const started = await post("/api/update", "active");
      expect(started.status).toBe(202);
      expect((await started.json()).update.step).toBe("scarico");
      expect((await post("/api/update", "active")).status).toBe(409);
      expect((await presence("waiting")).update.status).toBe("progress");
      await post("/api/window/close", "active");
      await post("/api/window/close", "waiting");
      await restarted.promise;
      expect(idle).toBe(false);
      expect((await presence("reopened")).update.step).toBe("riavvio");
      expect(git(clone, "describe", "--tags", "--exact-match")).toBe("v0.2.0");
      expect(git(clone, "status", "--porcelain", "--untracked-files=no")).toBe(
        "",
      );
      expect(
        readFileSync(
          join(clone, ".aggiornamento", "precedente", "node_modules", "old"),
          "utf8",
        ),
      ).toBe("previous dependencies");
      expect(
        readFileSync(
          join(clone, ".aggiornamento", "precedente", "dist", "old"),
          "utf8",
        ),
      ).toBe("previous build");
      expect(existsSync(join(clone, "dist", ".gaetanata-build"))).toBe(
        !nodeCompleto,
      );
      const snapshot = new DatabaseSync(
        join(clone, "data", "prima-di-aggiornamento.db"),
      );
      expect(
        snapshot.prepare("SELECT value FROM test_snapshot").get()?.value,
      ).toBe("WAL content");
      snapshot.close();
      expect(
        JSON.parse(
          readFileSync(join(clone, ".aggiornamento", "riavvio.json"), "utf8"),
        ),
      ).toMatchObject({
        da: "0.1.0",
        a: "0.2.0",
        tipo: "clone",
        refPrecedente: previousRef,
        nodeCompleto,
      });
    } finally {
      server.close();
      releases.close();
      await Promise.all([once(server, "close"), once(releases, "close")]);
      rmSync(root, { recursive: true, force: true });
    }
  },
  90_000,
);

it.each(["version mismatch", "partial checkout"])(
  "restores a clone after %s",
  async (scenario) => {
    const root = mkdtempSync(join(tmpdir(), "gaetanata-version-"));
    const source = join(root, "source");
    const clone = join(root, "clone");
    mkdirSync(source);
    const git = (cwd: string, ...args: string[]) =>
      execFileSync("git", args, { cwd, stdio: "pipe" });
    git(source, "init");
    git(source, "config", "user.email", "test@example.invalid");
    git(source, "config", "user.name", "Test");
    writeFileSync(join(source, ".gitignore"), "/data/\n/.aggiornamento/\n");
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({ version: "0.1.0" }),
    );
    git(source, "add", ".");
    git(source, "commit", "-m", "first");
    git(source, "tag", "v0.1.0");
    git(root, "clone", source, clone);
    writeFileSync(
      join(source, "package.json"),
      JSON.stringify({ version: "0.3.0" }),
    );
    git(source, "add", ".");
    git(source, "commit", "-m", "mismatch");
    git(source, "tag", "v0.2.0");
    if (scenario === "partial checkout") {
      const hook = join(clone, ".git", "hooks", "post-checkout");
      writeFileSync(
        hook,
        "#!/bin/sh\nif [ ! -f .git/failed-checkout ]; then touch .git/failed-checkout; echo broken > package.json; exit 1; fi\n",
      );
      chmodSync(hook, 0o755);
    }
    const releases = createServer((_req, res) =>
      res.end(JSON.stringify({ tag_name: "v0.2.0", body: "" })),
    );
    releases.listen(0, "127.0.0.1");
    await once(releases, "listening");
    const address = releases.address();
    if (!address || typeof address === "string") throw new Error("address");
    let restarted = false;
    const server = await startServer({
      port: 0,
      databaseFile: join(clone, "data", "gaetanata.db"),
      appDir: clone,
      onRestart: () => {
        restarted = true;
      },
      releaseSource: {
        apiUrl: `http://127.0.0.1:${address.port}`,
        gitUrl: source,
      },
    });
    try {
      const app = server.address();
      if (!app || typeof app === "string") throw new Error("address");
      const base = `http://127.0.0.1:${app.port}`;
      const post = (path: string) =>
        fetch(`${base}${path}`, {
          method: "POST",
          body: JSON.stringify({ windowId: "active" }),
        });
      const presence = async () =>
        (await (await post("/api/window")).json()).update;
      await expect
        .poll(async () => (await presence()).status, { timeout: 30_000 })
        .toBe("available");
      expect((await post("/api/update")).status).toBe(202);
      await expect
        .poll(async () => (await presence()).status, { timeout: 60_000 })
        .toBe("failed");
      expect((await presence()).message).toBe(
        "Aggiornamento non riuscito, stai usando ancora la versione 0.1.0",
      );
      expect(
        git(clone, "symbolic-ref", "--short", "HEAD").toString().trim(),
      ).toBe(git(source, "symbolic-ref", "--short", "HEAD").toString().trim());
      expect(
        JSON.parse(readFileSync(join(clone, "package.json"), "utf8")).version,
      ).toBe("0.1.0");
      expect(restarted).toBe(false);
      expect(existsSync(join(clone, "data", "prima-di-aggiornamento.db"))).toBe(
        true,
      );
    } finally {
      server.close();
      releases.close();
      await Promise.all([once(server, "close"), once(releases, "close")]);
      rmSync(root, { recursive: true, force: true });
    }
  },
  90_000,
);

it("installs a release ZIP and preserves data, runtime and the previous files", async () => {
  const parent = mkdtempSync(join(tmpdir(), "gaetanata-zip-install-"));
  const root = join(parent, "app");
  const source = join(parent, "source");
  const vite = join(parent, "fake-vite");
  mkdirSync(root);
  mkdirSync(source);
  mkdirSync(join(vite, "bin"), { recursive: true });
  writeFileSync(
    join(vite, "package.json"),
    JSON.stringify({ name: "vite", version: "1.0.0" }),
  );
  writeFileSync(
    join(vite, "bin/vite.js"),
    'require("node:fs").mkdirSync("dist",{recursive:true})',
  );
  writeFileSync(
    join(source, "package.json"),
    JSON.stringify({
      name: "fixture",
      version: "0.2.0",
      engines: { node: ">=22.13.0" },
      dependencies: { vite: "file:../fake-vite" },
    }),
  );
  const bin = dirname(process.execPath);
  const npm = [
    join(bin, "node_modules/npm/bin/npm-cli.js"),
    join(bin, "../lib/node_modules/npm/bin/npm-cli.js"),
  ].find(existsSync);
  if (!npm) throw new Error("npm not found");
  execFileSync(
    process.execPath,
    [
      npm,
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--offline",
      "--no-audit",
      "--no-fund",
    ],
    { cwd: source },
  );
  const zip = new PizZip();
  zip.file("release/package.json", readFileSync(join(source, "package.json")));
  zip.file(
    "release/package-lock.json",
    readFileSync(join(source, "package-lock.json")),
  );
  zip.file("release/src/index.ts", "new source");
  zip.file("release/index.html", "new html");
  zip.file("release/vite.config.ts", "");
  zip.file("release/avvia.sh", "new launcher");
  zip.file("release/avvia.command", "new launcher");
  const archive = zip.generate({ type: "nodebuffer" });
  mkdirSync(join(root, ".runtime"));
  mkdirSync(join(root, "node_modules"));
  mkdirSync(join(root, "dist"));
  mkdirSync(join(root, ".aggiornamento/precedente"), { recursive: true });
  writeFileSync(join(root, ".runtime/keep"), "runtime");
  writeFileSync(join(root, "node_modules/old"), "dependencies");
  writeFileSync(join(root, "dist/old"), "build");
  writeFileSync(join(root, ".aggiornamento/precedente/stale"), "stale");
  writeFileSync(join(root, "old-file"), "old");
  const releases = createServer((req, res) => {
    if (req.url === "/archive") res.end(archive);
    else
      res.end(
        JSON.stringify({
          tag_name: "v0.2.0",
          body: "",
          zipball_url: `http://${req.headers.host}/archive`,
        }),
      );
  });
  releases.listen(0, "127.0.0.1");
  await once(releases, "listening");
  const address = releases.address();
  if (!address || typeof address === "string") throw new Error("address");
  const restarted = Promise.withResolvers<void>();
  const server = await startServer({
    port: 0,
    databaseFile: join(root, "data/gaetanata.db"),
    appDir: root,
    onRestart: restarted.resolve,
    releaseSource: { apiUrl: `http://127.0.0.1:${address.port}`, gitUrl: root },
  });
  try {
    const app = server.address();
    if (!app || typeof app === "string") throw new Error("address");
    const base = `http://127.0.0.1:${app.port}`;
    const post = (path: string) =>
      fetch(`${base}${path}`, {
        method: "POST",
        body: JSON.stringify({ windowId: "active" }),
      });
    await expect
      .poll(
        async () => (await (await post("/api/window")).json()).update.status,
      )
      .toBe("available");
    expect((await post("/api/update")).status).toBe(202);
    await restarted.promise;
    expect(readFileSync(join(root, "src/index.ts"), "utf8")).toBe("new source");
    expect(readFileSync(join(root, ".runtime/keep"), "utf8")).toBe("runtime");
    expect(
      readFileSync(join(root, ".aggiornamento/precedente/old-file"), "utf8"),
    ).toBe("old");
    expect(
      readFileSync(
        join(root, ".aggiornamento/precedente/node_modules/old"),
        "utf8",
      ),
    ).toBe("dependencies");
    expect(
      readFileSync(join(root, ".aggiornamento/precedente/dist/old"), "utf8"),
    ).toBe("build");
    expect(existsSync(join(root, ".aggiornamento/precedente/stale"))).toBe(
      false,
    );
    expect(existsSync(join(root, "data/gaetanata.db"))).toBe(true);
    expect(
      JSON.parse(
        readFileSync(join(root, ".aggiornamento/riavvio.json"), "utf8"),
      ).tipo,
    ).toBe("zip");
  } finally {
    server.close();
    releases.close();
    await Promise.all([once(server, "close"), once(releases, "close")]);
    rmSync(parent, { recursive: true, force: true });
  }
}, 90_000);
