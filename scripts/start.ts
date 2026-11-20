// One-command start: install dependencies and rebuild only when needed,
// then serve the app on 127.0.0.1 and open the browser.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/app.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.PORT ?? 5174);
const url = `http://127.0.0.1:${port}`;

if (await alreadyRunning()) {
  console.log(`Gaetanata è già aperta: ${url}`);
  openBrowser(url);
  process.exit(0);
}

ensureDependencies();
ensureBuild();

await startServer({
  port,
  databaseFile: join(root, "data", "gaetanata.db"),
  staticDir: join(root, "dist"),
});
console.log(
  `Gaetanata è aperta su ${url}  (chiudi questa finestra per fermarla)`,
);
console.log(
  `I dati sono in ${join(root, "data")}: copia quella cartella per fare un backup.`,
);
openBrowser(url);

async function alreadyRunning(): Promise<boolean> {
  try {
    const res = await fetch(`${url}/api/health`, {
      signal: AbortSignal.timeout(1000),
    });
    const body = (await res.json()) as { app?: string };
    return body.app === "gaetanata";
  } catch {
    return false;
  }
}

function ensureDependencies(): void {
  const stamp = join(root, "node_modules", ".gaetanata-lock");
  const lockHash = hashFiles([join(root, "package-lock.json")]);
  if (existsSync(stamp) && readFileSync(stamp, "utf8") === lockHash) return;
  console.log(
    "Installo le dipendenze (solo la prima volta o dopo un aggiornamento)...",
  );
  run(npmCli(), ["ci", "--no-audit", "--no-fund"]);
  writeFileSync(stamp, lockHash);
}

function ensureBuild(): void {
  const stamp = join(root, "dist", ".gaetanata-build");
  const sourceHash = hashFiles([
    ...listFiles(join(root, "src")),
    join(root, "index.html"),
    join(root, "vite.config.ts"),
    join(root, "package-lock.json"),
  ]);
  if (existsSync(stamp) && readFileSync(stamp, "utf8") === sourceHash) return;
  console.log("Preparo l'interfaccia...");
  run(join(root, "node_modules", "vite", "bin", "vite.js"), ["build"]);
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

function run(script: string, args: string[]): void {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`Comando fallito: ${script} ${args.join(" ")}`);
  }
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf8" })
    .map((path) => join(dir, path))
    .filter((path) => statSync(path).isFile())
    .sort();
}

function hashFiles(files: string[]): string {
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.slice(root.length));
    hash.update(readFileSync(file));
  }
  return hash.digest("hex");
}

function openBrowser(target: string): void {
  if (process.env.GAETANATA_NO_BROWSER) return;
  const [command, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", target]]
      : process.platform === "darwin"
        ? ["open", [target]]
        : ["xdg-open", [target]];
  spawn(command, args, { stdio: "ignore", detached: true })
    .on("error", () => console.log(`Apri il browser su ${target}`))
    .unref();
}
