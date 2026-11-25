import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { expect, it } from "vitest";

it("relaunches the new server after exit 75 and verifies its ready version", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-restart-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("address");
  const port = address.port;
  reservation.close();
  await once(reservation, "close");
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    mkdirSync(join(root, ".aggiornamento"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(join(root, "index.html"), "");
    writeFileSync(join(root, "vite.config.ts"), "");
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    const next = `import {createServer} from "node:http";
import {watch,existsSync} from "node:fs";
const file=${JSON.stringify(join(root, ".aggiornamento", "riavvio.json"))};
const server=createServer((_req,res)=>res.end(JSON.stringify({app:"gaetanata",version:"0.2.0"})));
const watcher=watch(${JSON.stringify(join(root, ".aggiornamento"))},()=>{if(!existsSync(file)){watcher.close();server.close(()=>process.exit(0))}});
server.listen(${port},"127.0.0.1",()=>process.send?.("ready"));`;
    const first = `import {writeFileSync} from "node:fs";
writeFileSync(${JSON.stringify(join(root, ".aggiornamento", "riavvio.json"))}, JSON.stringify({da:"0.1.0",a:"0.2.0",tipo:"clone",refPrecedente:"main",nodeCompleto:false}));
writeFileSync(${JSON.stringify(join(root, "scripts", "serve.ts"))}, ${JSON.stringify(next)});
process.exit(75);`;
    writeFileSync(join(root, "scripts/serve.ts"), first);
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(root, "scripts/start.ts"),
      ],
      {
        cwd: root,
        env: { ...process.env, PORT: String(port), GAETANATA_NO_BROWSER: "1" },
        stdio: "pipe",
      },
    );
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    const [code] = await once(child, "exit");
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(existsSync(join(root, ".aggiornamento", "riavvio.json"))).toBe(
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);

it.each(["failed restart", "interrupted update with modified files"])(
  "restores the clone, dependencies and database after %s",
  async (scenario) => {
    const root = mkdtempSync(join(tmpdir(), "gaetanata-rollback-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, stdio: "pipe" }).toString().trim();
    try {
      cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
      mkdirSync(join(root, "src"));
      mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
      mkdirSync(join(root, "data"));
      writeFileSync(
        join(root, ".gitignore"),
        "/node_modules/\n/dist/\n/data/\n/.aggiornamento/\n",
      );
      writeFileSync(join(root, "package.json"), '{"type":"module"}');
      writeFileSync(join(root, "package-lock.json"), "{}");
      writeFileSync(
        join(root, "node_modules/.gaetanata-lock"),
        "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
      );
      writeFileSync(
        join(root, "node_modules/vite/bin/vite.js"),
        'require("node:fs").mkdirSync("dist",{recursive:true})',
      );
      writeFileSync(join(root, "node_modules/old"), "dependencies");
      writeFileSync(join(root, "index.html"), "");
      writeFileSync(join(root, "vite.config.ts"), "");
      const db = new DatabaseSync(join(root, "data/gaetanata.db"));
      db.exec(
        "CREATE TABLE value (v TEXT); INSERT INTO value VALUES ('before')",
      );
      db.close();
      const original = `import {execFileSync} from "node:child_process";
import {mkdirSync,renameSync,copyFileSync,writeFileSync} from "node:fs";
if(process.env.GAETANATA_AGGIORNAMENTO_FALLITO){writeFileSync("result",process.env.GAETANATA_AGGIORNAMENTO_FALLITO);process.exit(0)}
mkdirSync(".aggiornamento/precedente",{recursive:true});
copyFileSync("data/gaetanata.db","data/prima-di-aggiornamento.db");
execFileSync("git",["checkout","--detach","v0.2.0"]);
renameSync("node_modules",".aggiornamento/precedente/node_modules");
renameSync("dist",".aggiornamento/precedente/dist");
mkdirSync("node_modules");mkdirSync("dist");
writeFileSync(".aggiornamento/riavvio.json",JSON.stringify({da:"0.1.0",a:"0.2.0",tipo:"clone",refPrecedente:${JSON.stringify("OLD_BRANCH")},nodeCompleto:false}));
process.exit(75);`;
      git("init");
      git("config", "user.email", "test@example.invalid");
      git("config", "user.name", "Test");
      const branch = git("symbolic-ref", "--short", "HEAD");
      writeFileSync(
        join(root, "scripts/serve.ts"),
        original.replace("OLD_BRANCH", branch),
      );
      git("add", ".");
      git("commit", "-m", "old");
      writeFileSync(
        join(root, "scripts/serve.ts"),
        `import {DatabaseSync} from "node:sqlite";const db=new DatabaseSync("data/gaetanata.db");db.exec("UPDATE value SET v='after'");db.close();process.exit(1);`,
      );
      git("add", "scripts/serve.ts");
      git("commit", "-m", "broken");
      git("tag", "v0.2.0");
      git("checkout", "--detach", "HEAD~1");
      git("branch", "-f", branch, "HEAD");
      git("checkout", branch);
      if (scenario === "interrupted update with modified files") {
        mkdirSync(join(root, ".aggiornamento/precedente"), { recursive: true });
        cpSync(
          join(root, "data/gaetanata.db"),
          join(root, "data/prima-di-aggiornamento.db"),
        );
        git("checkout", "--detach", "v0.2.0");
        writeFileSync(join(root, "scripts/serve.ts"), "broken modified update");
        cpSync(
          join(root, "node_modules"),
          join(root, ".aggiornamento/precedente/node_modules"),
          { recursive: true },
        );
        writeFileSync(
          join(root, ".aggiornamento/riavvio.json"),
          JSON.stringify({
            da: "0.1.0",
            a: "0.2.0",
            tipo: "clone",
            refPrecedente: branch,
            nodeCompleto: false,
          }),
        );
      }
      const child = spawn(
        process.execPath,
        [
          "--experimental-strip-types",
          "--disable-warning=ExperimentalWarning",
          join(root, "scripts/start.ts"),
        ],
        {
          cwd: root,
          env: { ...process.env, PORT: "0", GAETANATA_NO_BROWSER: "1" },
          stdio: "pipe",
        },
      );
      const [code] = await once(child, "exit");
      expect(code).toBe(0);
      expect(readFileSync(join(root, "result"), "utf8")).toBe("0.1.0");
      expect(readFileSync(join(root, "node_modules/old"), "utf8")).toBe(
        "dependencies",
      );
      expect(git("symbolic-ref", "--short", "HEAD")).toBe(branch);
      const restored = new DatabaseSync(join(root, "data/gaetanata.db"));
      expect(restored.prepare("SELECT v FROM value").get()?.v).toBe("before");
      restored.close();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  },
  60_000,
);

it("restores ZIP files and the database after the new server fails", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-zip-rollback-"));
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    writeFileSync(join(root, "node_modules/old"), "dependencies");
    writeFileSync(join(root, "index.html"), "");
    writeFileSync(join(root, "vite.config.ts"), "");
    writeFileSync(join(root, "old-file"), "old");
    const db = new DatabaseSync(join(root, "data/gaetanata.db"));
    db.exec("CREATE TABLE value (v TEXT); INSERT INTO value VALUES ('before')");
    db.close();
    const broken = `import {DatabaseSync} from "node:sqlite";const db=new DatabaseSync("data/gaetanata.db");db.exec("UPDATE value SET v='after'");db.close();process.exit(1);`;
    const original = `import {mkdirSync,renameSync,copyFileSync,writeFileSync} from "node:fs";
if(process.env.GAETANATA_AGGIORNAMENTO_FALLITO){writeFileSync("result",process.env.GAETANATA_AGGIORNAMENTO_FALLITO);process.exit(0)}
mkdirSync(".aggiornamento/precedente",{recursive:true});
copyFileSync("data/gaetanata.db","data/prima-di-aggiornamento.db");
for(const name of ["scripts","src","package.json","package-lock.json","index.html","vite.config.ts","old-file","node_modules","dist"]) renameSync(name,".aggiornamento/precedente/"+name);
mkdirSync("scripts");mkdirSync("node_modules");mkdirSync("dist");
writeFileSync("scripts/serve.ts",${JSON.stringify(broken)});
writeFileSync("new-file","new");
writeFileSync(".aggiornamento/riavvio.json",JSON.stringify({da:"0.1.0",a:"0.2.0",tipo:"zip",refPrecedente:"",nodeCompleto:false}));
process.exit(75);`;
    writeFileSync(join(root, "scripts/serve.ts"), original);
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(root, "scripts/start.ts"),
      ],
      {
        cwd: root,
        env: { ...process.env, PORT: "0", GAETANATA_NO_BROWSER: "1" },
        stdio: "pipe",
      },
    );
    const [code] = await once(child, "exit");
    expect(code).toBe(0);
    expect(readFileSync(join(root, "result"), "utf8")).toBe("0.1.0");
    expect(readFileSync(join(root, "old-file"), "utf8")).toBe("old");
    expect(existsSync(join(root, "new-file"))).toBe(false);
    expect(readFileSync(join(root, "node_modules/old"), "utf8")).toBe(
      "dependencies",
    );
    const restored = new DatabaseSync(join(root, "data/gaetanata.db"));
    expect(restored.prepare("SELECT v FROM value").get()?.v).toBe("before");
    restored.close();
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 60_000);

it("hands a restart requiring another Node to a launcher and starts the new server", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-node-restart-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("address");
  const port = address.port;
  reservation.close();
  await once(reservation, "close");
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    mkdirSync(join(root, ".aggiornamento"));
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(join(root, "index.html"), "");
    writeFileSync(join(root, "vite.config.ts"), "");
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    writeFileSync(
      join(root, "scripts/serve.ts"),
      `import {existsSync,writeFileSync} from "node:fs";
import {createServer} from "node:http";
if(!existsSync(".aggiornamento/riavvio.json")) {
  writeFileSync(".aggiornamento/riavvio.json",JSON.stringify({da:"0.1.0",a:"0.2.0",tipo:"zip",refPrecedente:"",nodeCompleto:true}));
  process.exit(75);
}
createServer((req,res) => { if(req.url === "/stop") { res.end(); setTimeout(() => process.exit(0), 20); } else { res.setHeader("content-type","application/json"); res.end(JSON.stringify({app:"gaetanata",version:"0.2.0"})); } }).listen(Number(process.env.PORT),"127.0.0.1",() => process.send?.("ready"));
setTimeout(() => process.exit(1), 15000);`,
    );
    writeFileSync(
      join(root, process.platform === "win32" ? "avvia.cmd" : "avvia.sh"),
      process.platform === "win32"
        ? `@echo ready> "${join(root, ".aggiornamento", "launcher-pronto")}"\r\n@"${process.execPath}" --experimental-strip-types --disable-warning=ExperimentalWarning "${join(root, "scripts", "start.ts")}" --resume-update\r\n`
        : `#!/bin/sh\necho ready > .aggiornamento/launcher-pronto\n"${process.execPath}" --experimental-strip-types --disable-warning=ExperimentalWarning "${join(root, "scripts", "start.ts")}" --resume-update\n`,
      { mode: 0o755 },
    );
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(root, "scripts/start.ts"),
      ],
      {
        cwd: root,
        env: { ...process.env, PORT: String(port), GAETANATA_NO_BROWSER: "1" },
        stdio: "pipe",
      },
    );
    const [code] = await once(child, "exit");
    expect(code).toBe(0);
    await expect
      .poll(
        async () => {
          try {
            const response = await fetch(`http://127.0.0.1:${port}/api/health`);
            return await response.json();
          } catch {
            return null;
          }
        },
        { timeout: 10_000 },
      )
      .toEqual({ app: "gaetanata", version: "0.2.0" });
    await expect
      .poll(() => existsSync(join(root, ".aggiornamento", "riavvio.json")), {
        timeout: 10_000,
      })
      .toBe(false);
    await fetch(`http://127.0.0.1:${port}/stop`);
    await expect
      .poll(
        async () => {
          try {
            await fetch(`http://127.0.0.1:${port}/api/health`);
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      )
      .toBe(false);
  } finally {
    await expect
      .poll(
        () => {
          try {
            rmSync(root, { recursive: true, force: true });
            return true;
          } catch {
            return false;
          }
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  }
}, 20_000);

it("restores a ZIP after a resumed launcher fails to start the new server", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-node-rollback-"));
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    mkdirSync(join(root, "src"));
    mkdirSync(join(root, "node_modules/vite/bin"), { recursive: true });
    mkdirSync(join(root, ".aggiornamento/precedente/scripts"), {
      recursive: true,
    });
    mkdirSync(join(root, ".aggiornamento/precedente/node_modules"), {
      recursive: true,
    });
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "data/gaetanata.db"), "after");
    writeFileSync(join(root, "data/prima-di-aggiornamento.db"), "before");
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    writeFileSync(join(root, "package-lock.json"), "{}");
    writeFileSync(join(root, "index.html"), "");
    writeFileSync(join(root, "vite.config.ts"), "");
    writeFileSync(
      join(root, "node_modules/.gaetanata-lock"),
      "017884b51b91073c9a6fa06ce0f8cafee3a89d685fce596de57d7c6da25ad303",
    );
    writeFileSync(
      join(root, "node_modules/vite/bin/vite.js"),
      'require("node:fs").mkdirSync("dist",{recursive:true})',
    );
    writeFileSync(join(root, "scripts/serve.ts"), "process.exit(1)");
    writeFileSync(
      join(root, ".aggiornamento/precedente/package.json"),
      '{"type":"module"}',
    );
    writeFileSync(
      join(root, ".aggiornamento/precedente/node_modules/old"),
      "old",
    );
    writeFileSync(
      join(root, ".aggiornamento/precedente/scripts/serve.ts"),
      'import {writeFileSync} from "node:fs";writeFileSync("result",process.env.GAETANATA_AGGIORNAMENTO_FALLITO);process.exit(0)',
    );
    writeFileSync(
      join(root, ".aggiornamento/riavvio.json"),
      JSON.stringify({
        da: "0.1.0",
        a: "0.2.0",
        tipo: "zip",
        refPrecedente: "",
        nodeCompleto: true,
      }),
    );
    const child = spawn(
      process.execPath,
      [
        "--experimental-strip-types",
        "--disable-warning=ExperimentalWarning",
        join(root, "scripts/start.ts"),
        "--resume-update",
      ],
      {
        cwd: root,
        env: { ...process.env, PORT: "0", GAETANATA_NO_BROWSER: "1" },
        stdio: "pipe",
      },
    );
    const [code] = await once(child, "exit");
    expect(code).toBe(0);
    expect(readFileSync(join(root, "result"), "utf8")).toBe("0.1.0");
    expect(readFileSync(join(root, "data/gaetanata.db"), "utf8")).toBe(
      "before",
    );
    expect(readFileSync(join(root, "node_modules/old"), "utf8")).toBe("old");
    expect(existsSync(join(root, ".aggiornamento/riavvio.json"))).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}, 20_000);

it.each(["--resume-update", "--rollback-update"])(
  "reports both rollback versions from the real server after %s",
  async (mode) => {
    const root = mkdtempSync(join(tmpdir(), "gaetanata-report-rollback-"));
    const reservation = createServer();
    reservation.listen(0, "127.0.0.1");
    await once(reservation, "listening");
    const address = reservation.address();
    if (!address || typeof address === "string") throw new Error("address");
    const port = address.port;
    reservation.close();
    await once(reservation, "close");
    let child: ChildProcess | undefined;
    try {
      const previous = join(root, ".aggiornamento/precedente");
      for (const directory of ["src", "server", "scripts"]) {
        cpSync(directory, join(previous, directory), { recursive: true });
      }
      // Dependencies are read-only; keep the fixture small and never run npm.
      symlinkSync(
        resolve("node_modules"),
        join(root, "node_modules"),
        "junction",
      );
      writeFileSync(
        join(previous, "scripts/serve.ts"),
        `
import {startServer} from "../server/app.ts";
import {writeFileSync} from "node:fs";
process.on("disconnect", () => process.exit(0));
const server = await startServer({
  port: Number(process.env.PORT), databaseFile: "data/gaetanata.db",
  failedUpdateVersion: process.env.GAETANATA_AGGIORNAMENTO_FALLITO,
  failedUpdateTarget: process.env.GAETANATA_AGGIORNAMENTO_VERSIONE_TENTATA,
  fallback: (req, res) => {
    if (req.url !== "/restart") return res.writeHead(404).end();
    writeFileSync(".aggiornamento/riavvio.json", JSON.stringify({
      da: "0.1.0", a: "0.1.0", tipo: "zip", refPrecedente: "",
    }));
    res.on("finish", () => {
      server.close(() => process.exit(75));
      server.closeAllConnections();
    });
    res.end("riavvio");
  },
});
process.send?.("ready");
`,
      );
      cpSync("package.json", join(previous, "package.json"));
      cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
      writeFileSync(join(root, "scripts/serve.ts"), "process.exit(1)");
      writeFileSync(join(root, "package.json"), '{"type":"module"}');
      mkdirSync(join(root, "data"));
      const db = new DatabaseSync(join(root, "data/prima-di-aggiornamento.db"));
      db.close();
      writeFileSync(
        join(root, ".aggiornamento/riavvio.json"),
        JSON.stringify({
          da: "0.1.0",
          a: "99.2.0",
          tipo: "zip",
          refPrecedente: "",
          nodeCompleto: false,
        }),
      );
      child = spawn(
        process.execPath,
        [
          "--experimental-strip-types",
          "--disable-warning=ExperimentalWarning",
          join(root, "scripts/start.ts"),
          mode,
        ],
        {
          cwd: root,
          env: {
            ...process.env,
            PORT: String(port),
            GAETANATA_NO_BROWSER: "1",
          },
          stdio: "pipe",
        },
      );
      let output = "";
      child.stdout?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      child.stderr?.on("data", (chunk: Buffer) => { output += chunk.toString(); });
      await expect.poll(() => output, { timeout: 15_000 }).toContain("Gaetanata è aperta su");
      await expect
        .poll(
          async () => {
            try {
              const response = await fetch(
                `http://127.0.0.1:${port}/api/window`,
                {
                  method: "POST",
                  body: JSON.stringify({ windowId: "report" }),
                },
              );
              return (await response.json()).update;
            } catch {
              return null;
            }
          },
          { timeout: 15_000 },
        )
        .toMatchObject({
          status: "failed",
          from: "0.1.0",
          version: "99.2.0",
        });
      const base = `http://127.0.0.1:${port}`;
      const report = async () => (await (await fetch(`${base}/api/report`)).json());
      expect((await report()).errors).toEqual([
        expect.objectContaining({
          origin: "aggiornamento",
          message: expect.stringContaining("99.2.0"),
        }),
      ]);
      for (let restart = 0; restart < 2; restart++) {
        expect(await (await fetch(`${base}/restart`)).text()).toBe("riavvio");
        await expect.poll(async () => {
          try {
            const response = await fetch(`${base}/api/window`, {
              method: "POST",
              body: JSON.stringify({ windowId: "report" }),
              signal: AbortSignal.timeout(1_000),
            });
            return (await response.json()).update;
          } catch {
            return null;
          }
        }, { timeout: 15_000 }).toMatchObject({ status: "idle" });
        await expect.poll(() => existsSync(join(root, ".aggiornamento/riavvio.json"))).toBe(false);
        expect((await report()).errors).toHaveLength(1);
      }
    } finally {
      if (child && child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
      await expect
        .poll(
          () => {
            try {
              rmSync(root, { recursive: true, force: true });
              return true;
            } catch {
              return false;
            }
          },
          { timeout: 10_000 },
        )
        .toBe(true);
    }
  },
  60_000,
);

it("stops readiness polling when the restored server exits by signal", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-signaled-restart-"));
  let child: ChildProcess | undefined;
  try {
    cpSync("scripts/start.ts", join(root, "scripts/start.ts"));
    const previous = join(root, ".aggiornamento/precedente");
    mkdirSync(join(previous, "scripts"), { recursive: true });
    writeFileSync(join(previous, "package.json"), '{"type":"module"}');
    writeFileSync(join(previous, "scripts/serve.ts"),
      'process.send?.("ready", () => process.kill(process.pid, "SIGTERM"));');
    mkdirSync(join(root, "data"));
    writeFileSync(join(root, "data/prima-di-aggiornamento.db"), "");
    writeFileSync(join(root, ".aggiornamento/riavvio.json"), JSON.stringify({
      da: "0.1.0", a: "0.2.0", tipo: "zip", refPrecedente: "",
    }));
    child = spawn(process.execPath, [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      join(root, "scripts/start.ts"), "--rollback-update",
    ], {
      cwd: root,
      env: { ...process.env, PORT: "0", GAETANATA_NO_BROWSER: "1" },
      stdio: "pipe",
    });
    child.stdout?.resume();
    child.stderr?.resume();
    await expect.poll(() => child?.exitCode, { timeout: 3_000 }).toBe(
      process.platform === "win32" ? 1 : 143,
    );
  } finally {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, "exit");
      child.kill("SIGKILL");
      await exited;
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 10_000);
