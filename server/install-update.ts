import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import {
  chmod,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { ensureBuild, ensureDependencies } from "../scripts/start.ts";
import type { UpdateState } from "../src/update.ts";
import { boundedTemplateZip } from "./template-zip.ts";

const execute = promisify(execFile);
const gitEnv = {
  ...process.env,
  GIT_TERMINAL_PROMPT: "0",
  GIT_SSH_COMMAND: "ssh -oBatchMode=yes",
};

/** Synchronous preflight keeps refusal and transition to progress atomic. */
export function inspectClone(
  root: string,
): { ref: string } | { error: string } {
  try {
    const git = (...args: string[]) =>
      execFileSync("git", args, {
        cwd: root,
        env: gitEnv,
        encoding: "utf8",
        timeout: 10_000,
        windowsHide: true,
      }).trim();
    if (git("status", "--porcelain", "--untracked-files=no"))
      return {
        error: "Il clone contiene file modificati: contatta chi ti aiuta.",
      };
    let ref: string;
    try {
      ref = git("symbolic-ref", "--quiet", "--short", "HEAD");
    } catch {
      ref = git("rev-parse", "HEAD");
    }
    return { ref };
  } catch {
    return {
      error: "Impossibile controllare il clone Git: contatta chi ti aiuta.",
    };
  }
}

export async function installClone(options: {
  root: string;
  databaseFile: string;
  db: DatabaseSync;
  gitUrl: string;
  from: string;
  version: string;
  ref: string;
  setState: (state: UpdateState) => void;
  restart: () => void;
}): Promise<void> {
  const {
    root,
    databaseFile,
    db,
    gitUrl,
    from,
    version,
    ref,
    setState,
    restart,
  } = options;
  const progress = (step: "scarico" | "installo" | "preparo" | "riavvio") =>
    setState({ status: "progress", step, from, version });
  const git = (...args: string[]) =>
    execute("git", args, {
      cwd: root,
      env: gitEnv,
      timeout: 120_000,
      windowsHide: true,
    });
  const updateDir = join(root, ".aggiornamento");
  const previous = join(updateDir, "precedente");
  const temporaryBackup = join(
    dirname(databaseFile),
    "prima-di-aggiornamento.tmp.db",
  );
  const backup = join(dirname(databaseFile), "prima-di-aggiornamento.db");
  let checkedOut = false;
  const moved: string[] = [];
  try {
    await git(
      "fetch",
      "--no-tags",
      gitUrl,
      `refs/tags/v${version}:refs/tags/v${version}`,
    );
    await rm(temporaryBackup, { force: true });
    db.prepare("VACUUM INTO ?").run(temporaryBackup);
    await rename(temporaryBackup, backup);
    await mkdir(updateDir, { recursive: true });
    await writeFile(
      join(updateDir, "riavvio.json"),
      JSON.stringify({
        da: from,
        a: version,
        tipo: "clone",
        refPrecedente: ref,
        nodeCompleto: false,
      }),
    );
    await git("checkout", "--detach", `v${version}`);
    checkedOut = true;
    const pkg: unknown = JSON.parse(
      await readFile(join(root, "package.json"), "utf8"),
    );
    if (
      !pkg ||
      typeof pkg !== "object" ||
      !("version" in pkg) ||
      pkg.version !== version
    )
      throw new Error("La versione del package non coincide con il tag.");
    await rm(previous, { recursive: true, force: true });
    await mkdir(previous, { recursive: true });
    for (const name of ["node_modules", "dist"]) {
      if (existsSync(join(root, name))) {
        await rename(join(root, name), join(previous, name));
        moved.push(name);
      }
    }
    progress("installo");
    await ensureDependencies(root);
    progress("preparo");
    await ensureBuild(root);
    progress("riavvio");
    // Presence runs every five seconds, including in inactive windows. Give
    // those windows time to observe restart before the server disappears.
    await delay(6_000);
    restart();
  } catch (error) {
    await rm(temporaryBackup, { force: true });
    try {
      if (checkedOut) await git("checkout", ref);
      for (const name of moved) {
        await rm(join(root, name), { recursive: true, force: true });
        await rename(join(previous, name), join(root, name));
      }
      await rm(join(updateDir, "riavvio.json"), { force: true });
      setState({
        status: "failed",
        message: `Aggiornamento non riuscito, stai usando ancora la versione ${from}`,
      });
    } catch (restoreError) {
      console.error("Ripristino non riuscito", error, restoreError);
      setState({
        status: "failed",
        message: "Ripristino non riuscito. Contatta chi ti aiuta.",
      });
    }
  }
}

export async function installZip(options: {
  root: string;
  databaseFile: string;
  db: DatabaseSync;
  gitUrl: string;
  zipUrl: string;
  from: string;
  version: string;
  ref: string;
  setState: (state: UpdateState) => void;
  restart: () => void;
}): Promise<void> {
  const { root, databaseFile, db, zipUrl, from, version, setState, restart } =
    options;
  const updateDir = join(root, ".aggiornamento");
  const previous = join(updateDir, "precedente");
  const staging = join(updateDir, "nuova");
  const temporaryBackup = join(
    dirname(databaseFile),
    "prima-di-aggiornamento.tmp.db",
  );
  const backup = join(dirname(databaseFile), "prima-di-aggiornamento.db");
  const protectedNames = new Set([
    "data",
    ".runtime",
    "node_modules",
    "dist",
    ".aggiornamento",
  ]);
  const moved: string[] = [];
  const installed: string[] = [];
  const dependencies: string[] = [];
  const progress = (step: "installo" | "preparo" | "riavvio") =>
    setState({ status: "progress", step, from, version });
  try {
    const response = await fetch(zipUrl, {
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok || !response.body)
      throw new Error("Download ZIP non riuscito");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 40 * 1024 * 1024) {
        await reader.cancel();
        throw new Error("Archivio ZIP troppo grande");
      }
      chunks.push(value);
    }
    const zip = boundedTemplateZip(Buffer.concat(chunks));
    await rm(staging, { recursive: true, force: true });
    await mkdir(staging, { recursive: true });
    let prefix: string | undefined;
    for (const [name, entry] of Object.entries(zip.files)) {
      const parts = name.split("/");
      if (!prefix) prefix = parts[0];
      if (
        !prefix ||
        parts[0] !== prefix ||
        parts.some(
          (part) => part === "." || part === ".." || part.includes("\\"),
        )
      )
        throw new Error("Percorso ZIP non valido");
      const relative = parts.slice(1).filter(Boolean);
      if (!relative.length) continue;
      if (protectedNames.has(relative[0] ?? ""))
        throw new Error("Percorso ZIP riservato");
      const target = join(staging, ...relative);
      if (entry.dir) await mkdir(target, { recursive: true });
      else {
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, entry.asNodeBuffer());
      }
    }
    const pkg: unknown = JSON.parse(
      await readFile(join(staging, "package.json"), "utf8"),
    );
    if (
      !pkg ||
      typeof pkg !== "object" ||
      !("version" in pkg) ||
      pkg.version !== version
    )
      throw new Error("La versione del package non coincide con il tag.");
    for (const name of ["avvia.sh", "avvia.command"]) {
      if (existsSync(join(staging, name)))
        await chmod(join(staging, name), 0o755);
    }
    await rm(temporaryBackup, { force: true });
    db.prepare("VACUUM INTO ?").run(temporaryBackup);
    await rename(temporaryBackup, backup);
    await rm(previous, { recursive: true, force: true });
    await mkdir(previous, { recursive: true });
    for (const name of await readdir(root)) {
      if (protectedNames.has(name)) continue;
      await rename(join(root, name), join(previous, name));
      moved.push(name);
    }
    for (const name of await readdir(staging)) {
      await rename(join(staging, name), join(root, name));
      installed.push(name);
    }
    for (const name of ["node_modules", "dist"]) {
      if (existsSync(join(root, name))) {
        await rename(join(root, name), join(previous, name));
        dependencies.push(name);
      }
    }
    await writeFile(
      join(updateDir, "riavvio.json"),
      JSON.stringify({
        da: from,
        a: version,
        tipo: "zip",
        refPrecedente: "",
        nodeCompleto: false,
      }),
    );
    progress("installo");
    await ensureDependencies(root);
    progress("preparo");
    await ensureBuild(root);
    progress("riavvio");
    await delay(6_000);
    restart();
  } catch (error) {
    try {
      await rm(temporaryBackup, { force: true });
      for (const name of installed)
        await rm(join(root, name), { recursive: true, force: true });
      for (const name of [...moved, ...dependencies]) {
        await rm(join(root, name), { recursive: true, force: true });
        await rename(join(previous, name), join(root, name));
      }
      await rm(join(updateDir, "riavvio.json"), { force: true });
      setState({
        status: "failed",
        message: `Aggiornamento non riuscito, stai usando ancora la versione ${from}`,
      });
    } catch (restoreError) {
      console.error("Ripristino non riuscito", error, restoreError);
      setState({
        status: "failed",
        message: "Ripristino non riuscito. Contatta chi ti aiuta.",
      });
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
