// One-command start: install dependencies and rebuild only when needed,
// then serve the app on 127.0.0.1 and open the browser.
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5174);
const url = `http://127.0.0.1:${port}`;

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const restartFile = join(root, ".aggiornamento", "riavvio.json");
  // Exit 10 means preparation is needed; no network, writes or server in this mode.
  if (process.argv.includes("--check-setup")) {
    process.exit(existsSync(restartFile) || !needsSetup() ? 0 : 10);
  }

  if (await alreadyRunning()) {
    console.log(`Gaetanata è già aperta: ${url}`);
    openBrowser(url);
    process.exit(0);
  }

  const rollbackUpdate =
    process.argv.includes("--rollback-update") ||
    (existsSync(restartFile) && !process.argv.includes("--resume-update"));
  const resumeUpdate =
    process.argv.includes("--resume-update") || rollbackUpdate;

  if (!resumeUpdate) {
    await ensureDependencies(root);
    await ensureBuild(root);
  }

  let restarting = false;
  let expectedVersion: string | undefined;
  let failedVersion: string | undefined;
  let previousRef: string | undefined;
  let previousType: "clone" | "zip" = "clone";
  let previousVersion: string | undefined;
  if (resumeUpdate) {
    const protocol: unknown = JSON.parse(readFileSync(restartFile, "utf8"));
    if (
      !protocol ||
      typeof protocol !== "object" ||
      !("a" in protocol) ||
      typeof protocol.a !== "string" ||
      !("da" in protocol) ||
      typeof protocol.da !== "string" ||
      !("tipo" in protocol) ||
      (protocol.tipo !== "clone" && protocol.tipo !== "zip") ||
      !("refPrecedente" in protocol) ||
      typeof protocol.refPrecedente !== "string"
    )
      throw new Error("Protocollo di riavvio non valido");
    expectedVersion = protocol.a;
    previousVersion = protocol.da;
    previousType = protocol.tipo;
    previousRef = protocol.refPrecedente;
    restarting = true;
    if (rollbackUpdate) {
      restore(previousType, previousRef, restartFile);
      failedVersion = previousVersion;
      restarting = false;
      expectedVersion = undefined;
    } else {
      try {
        await ensureDependencies(root);
        await ensureBuild(root);
      } catch (error) {
        console.error(error);
        restore(previousType, previousRef, restartFile);
        failedVersion = previousVersion;
        restarting = false;
        expectedVersion = undefined;
      }
    }
  }
  for (;;) {
    // The launcher stays in memory while checkout replaces files on disk.
    const child = spawn(
      process.execPath,
      [...process.execArgv, join(root, "scripts", "serve.ts")],
      {
        cwd: root,
        env: { ...process.env, GAETANATA_AGGIORNAMENTO_FALLITO: failedVersion },
        windowsHide: true,
        stdio: ["inherit", "inherit", "inherit", "ipc"],
      },
    );
    const { promise: stopped, resolve } = Promise.withResolvers<number>();
    let ready = false;
    const timer = restarting
      ? setTimeout(() => {
          if (!ready) child.kill();
        }, 60_000)
      : undefined;
    child.on("message", async (message) => {
      if (message !== "ready") return;
      const deadline = Date.now() + 60_000;
      while (Date.now() < deadline && child.exitCode === null) {
        if (await alreadyRunning(expectedVersion)) {
          ready = true;
          clearTimeout(timer);
          if (restarting) {
            for (const name of ["node_modules", "dist"])
              rmSync(join(root, ".aggiornamento", "precedente", name), {
                recursive: true,
                force: true,
              });
            if (existsSync(restartFile)) unlinkSync(restartFile);
          } else {
            console.log(
              `Gaetanata è aperta su ${url} (chiudi la finestra dell'app per fermarla)`,
            );
            console.log(
              `I dati sono in ${process.env.GAETANATA_DATA_DIR ?? join(root, "data")}: copia quella cartella per fare un backup.`,
            );
            openBrowser(url);
          }
          return;
        }
        await delay(500);
      }
    });
    child.on("error", (error) => {
      console.error(error);
      resolve(1);
    });
    child.on("exit", (code, signal) => {
      resolve(
        code ?? (signal === "SIGINT" ? 130 : signal === "SIGHUP" ? 129 : 143),
      );
    });
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    const hangup = () => child.kill("SIGHUP");
    process.on("SIGINT", interrupt);
    process.on("SIGTERM", terminate);
    process.on("SIGHUP", hangup);
    process.on("exit", terminate);
    const code = await stopped;
    clearTimeout(timer);
    process.off("SIGINT", interrupt);
    process.off("SIGTERM", terminate);
    process.off("SIGHUP", hangup);
    process.off("exit", terminate);
    if (restarting && !ready) {
      if (!previousVersion || (previousType === "clone" && !previousRef))
        throw new Error("Protocollo di riavvio non valido");
      restore(previousType, previousRef ?? "", restartFile);
      failedVersion = previousVersion;
      restarting = false;
      expectedVersion = undefined;
      continue;
    }
    if (code !== 75) {
      process.exitCode = code;
      break;
    }
    const protocol: unknown = JSON.parse(readFileSync(restartFile, "utf8"));
    if (
      !protocol ||
      typeof protocol !== "object" ||
      !("a" in protocol) ||
      typeof protocol.a !== "string" ||
      !("da" in protocol) ||
      typeof protocol.da !== "string" ||
      !("tipo" in protocol) ||
      (protocol.tipo !== "clone" && protocol.tipo !== "zip") ||
      !("refPrecedente" in protocol) ||
      typeof protocol.refPrecedente !== "string"
    )
      throw new Error("Protocollo di riavvio non valido");
    if ("nodeCompleto" in protocol && protocol.nodeCompleto === true) {
      const acknowledgement = join(root, ".aggiornamento", "launcher-pronto");
      rmSync(acknowledgement, { force: true });
      const env = {
        ...process.env,
        GAETANATA_RESTART_PARENT: String(process.pid),
        GAETANATA_PREVIOUS_NODE: process.execPath,
      };
      const launcher =
        process.platform === "win32"
          ? spawn(
              process.env.ComSpec ?? "cmd.exe",
              [
                "/d",
                "/s",
                "/c",
                `""${join(root, "avvia.cmd")}" --resume-update"`,
              ],
              {
                cwd: root,
                env,
                detached: true,
                stdio: "ignore",
                windowsVerbatimArguments: true,
              },
            )
          : spawn("bash", [join(root, "avvia.sh"), "--resume-update"], {
              cwd: root,
              env,
              detached: true,
              stdio: "ignore",
            });
      let launcherFailed = false;
      launcher.once("error", () => {
        launcherFailed = true;
      });
      launcher.once("exit", () => {
        launcherFailed = true;
      });
      const deadline = Date.now() + 15_000;
      while (
        !launcherFailed &&
        !existsSync(acknowledgement) &&
        Date.now() < deadline
      )
        await delay(50);
      if (!existsSync(acknowledgement)) {
        launcher.kill();
        restore(protocol.tipo, protocol.refPrecedente, restartFile);
        failedVersion = protocol.da;
        restarting = false;
        expectedVersion = undefined;
        continue;
      }
      rmSync(acknowledgement, { force: true });
      launcher.unref();
      break;
    }
    expectedVersion = protocol.a;
    previousType = protocol.tipo;
    previousRef = protocol.refPrecedente;
    previousVersion = protocol.da;
    restarting = true;
  }
}

function restore(
  previousType: "clone" | "zip",
  previousRef: string,
  restartFile: string,
): void {
  if (previousType === "clone") {
    execFileSync("git", ["checkout", "--force", previousRef], {
      cwd: root,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
      stdio: "inherit",
    });
  } else {
    const protectedNames = [
      "data",
      ".runtime",
      "node_modules",
      "dist",
      ".aggiornamento",
    ];
    for (const name of readdirSync(root)) {
      if (!protectedNames.includes(name))
        rmSync(join(root, name), { recursive: true, force: true });
    }
    const saved = join(root, ".aggiornamento", "precedente");
    for (const name of readdirSync(saved)) {
      if (name !== "node_modules" && name !== "dist")
        renameSync(join(saved, name), join(root, name));
    }
  }
  const previous = join(root, ".aggiornamento", "precedente");
  for (const name of ["node_modules", "dist"]) {
    const saved = join(previous, name);
    if (existsSync(saved)) {
      rmSync(join(root, name), { recursive: true, force: true });
      renameSync(saved, join(root, name));
    }
  }
  const data = process.env.GAETANATA_DATA_DIR ?? join(root, "data");
  const database = join(data, "gaetanata.db");
  rmSync(`${database}-wal`, { force: true });
  rmSync(`${database}-shm`, { force: true });
  copyFileSync(join(data, "prima-di-aggiornamento.db"), database);
  rmSync(restartFile, { force: true });
}

async function alreadyRunning(expectedVersion?: string): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const body = (await res.json()) as { app?: string; version?: string };
    return (
      res.ok &&
      body.app === "gaetanata" &&
      (expectedVersion === undefined || body.version === expectedVersion)
    );
  } catch {
    return false;
  }
}

function buildHash(root: string): string {
  return hashFiles(root, [
    ...listFiles(join(root, "src")),
    ...(existsSync(join(root, "public"))
      ? listFiles(join(root, "public"))
      : []),
    join(root, "index.html"),
    join(root, "vite.config.ts"),
    join(root, "package-lock.json"),
  ]);
}

function matchesStamp(path: string, hash: string): boolean {
  return existsSync(path) && readFileSync(path, "utf8") === hash;
}

function needsSetup(): boolean {
  return (
    !matchesStamp(
      join(root, "node_modules", ".gaetanata-lock"),
      hashFiles(root, [join(root, "package-lock.json")]),
    ) || !matchesStamp(join(root, "dist", ".gaetanata-build"), buildHash(root))
  );
}

export async function ensureDependencies(root: string): Promise<void> {
  const stamp = join(root, "node_modules", ".gaetanata-lock");
  const lockHash = hashFiles(root, [join(root, "package-lock.json")]);
  if (matchesStamp(stamp, lockHash)) return;
  console.log(
    "Installo le dipendenze (solo la prima volta o dopo un aggiornamento)...",
  );
  await run(root, npmCli(), ["ci", "--no-audit", "--no-fund"]);
  writeFileSync(stamp, lockHash);
}

export async function ensureBuild(root: string): Promise<void> {
  const stamp = join(root, "dist", ".gaetanata-build");
  const sourceHash = buildHash(root);
  if (matchesStamp(stamp, sourceHash)) return;
  console.log("Preparo l'interfaccia...");
  await run(root, join(root, "node_modules", "vite", "bin", "vite.js"), [
    "build",
  ]);
  writeFileSync(stamp, sourceHash);
}

/** npm ships next to the node binary, also in the portable runtime. */
function npmCli(): string {
  const bin = dirname(process.execPath);
  const candidates = [
    join(bin, "node_modules", "npm", "bin", "npm-cli.js"),
    join(bin, "..", "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ];
  const found = candidates.find((path) => existsSync(path));
  if (!found) throw new Error(`npm non trovato accanto a ${process.execPath}`);
  return found;
}

function run(root: string, script: string, args: string[]): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const child = spawn(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  child.once("error", reject);
  child.once("exit", (code) => {
    if (code === 0) resolve();
    else reject(new Error(`Comando fallito: ${script} ${args.join(" ")}`));
  });
  return promise;
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile())
    .sort();
}

function hashFiles(root: string, files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.slice(root.length));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

/** Browser policy from ADR 0008; a failed app launch uses the system default. */
export function chooseBrowser(
  platform: string,
  available: { edge: boolean; chrome: boolean },
  firstAttemptFailed = false,
): "edge" | "chrome" | "default" {
  if (firstAttemptFailed) return "default";
  if (platform === "win32" && available.edge) return "edge";
  if (platform === "darwin") {
    if (available.chrome) return "chrome";
    if (available.edge) return "edge";
  }
  return "default";
}

function openBrowser(target: string): void {
  if (process.env.GAETANATA_NO_BROWSER) return;
  const fallback: [string, string[]] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", target]]
      : process.platform === "darwin"
        ? ["open", [target]]
        : ["xdg-open", [target]];
  const edge =
    process.platform === "win32"
      ? [
          process.env.ProgramFiles ?? "C:\\Program Files",
          process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
        ]
          .map((location) =>
            join(location, "Microsoft", "Edge", "Application", "msedge.exe"),
          )
          .find((location) => existsSync(location))
      : undefined;
  const available = {
    edge:
      process.platform === "win32"
        ? Boolean(edge)
        : process.platform === "darwin" &&
          existsSync("/Applications/Microsoft Edge.app"),
    chrome:
      process.platform === "darwin" &&
      existsSync("/Applications/Google Chrome.app"),
  };
  const choice = chooseBrowser(process.platform, available);
  const preferred: [string, string[]] =
    choice === "default"
      ? fallback
      : process.platform === "win32"
        ? [edge ?? "msedge", [`--app=${target}`]]
        : [
            "open",
            [
              "-na",
              `/Applications/${choice === "chrome" ? "Google Chrome" : "Microsoft Edge"}.app`,
              "--args",
              `--app=${target}`,
            ],
          ];
  launch(preferred, choice !== "default");

  function launch(
    [command, args]: [string, string[]],
    canFallback: boolean,
  ): void {
    let failed = false;
    const onFailure = () => {
      if (failed) return;
      failed = true;
      if (
        canFallback &&
        chooseBrowser(process.platform, available, true) === "default"
      )
        launch(fallback, false);
      else console.log(`Apri il browser su ${target}`);
    };
    spawn(command, args, { stdio: "ignore", detached: true, windowsHide: true })
      .once("error", onFailure)
      .once("exit", (code, signal) => {
        if (code !== 0 || signal) onFailure();
      })
      .unref();
  }
}
