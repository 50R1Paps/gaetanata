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

function nodeSatisfies(pkg: object, version: string): boolean {
  if (
    !("engines" in pkg) ||
    !pkg.engines ||
    typeof pkg.engines !== "object" ||
    !("node" in pkg.engines) ||
    typeof pkg.engines.node !== "string"
  )
    return false;
  const required = /^>=(\d+)\.(\d+)\.(\d+)$/.exec(pkg.engines.node);
  const actual = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!required || !actual) return false;
  for (let i = 1; i <= 3; i++) {
    const difference = Number(actual[i]) - Number(required[i]);
    if (difference !== 0) return difference > 0;
  }
  return true;
}

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

type UpdateContext = {
  root: string;
  databaseFile: string;
  db: DatabaseSync;
  from: string;
  version: string;
  nodeVersion?: string;
  setState: (state: UpdateState) => void;
  restart: () => void;
  onFailure?: (error: unknown) => void;
};

async function backupDatabase(context: UpdateContext, temporary: string) {
  await rm(temporary, { force: true });
  context.db.prepare("VACUUM INTO ?").run(temporary);
  await rename(
    temporary,
    join(dirname(context.databaseFile), "prima-di-aggiornamento.db"),
  );
}

async function validatePackage(path: string, context: UpdateContext) {
  const pkg: unknown = JSON.parse(
    await readFile(join(path, "package.json"), "utf8"),
  );
  if (
    !pkg ||
    typeof pkg !== "object" ||
    !("version" in pkg) ||
    pkg.version !== context.version
  )
    throw new Error("La versione del package non coincide con il tag.");
  return !nodeSatisfies(pkg, context.nodeVersion ?? process.versions.node);
}

async function writeRestart(
  context: UpdateContext,
  tipo: "clone" | "zip",
  refPrecedente: string,
  nodeCompleto: boolean,
) {
  await writeFile(
    join(context.root, ".aggiornamento", "riavvio.json"),
    JSON.stringify({
      da: context.from,
      a: context.version,
      tipo,
      refPrecedente,
      nodeCompleto,
    }),
  );
}

async function prepareAndRestart(
  context: UpdateContext,
  nodeCompleto: boolean,
) {
  const progress = (step: "installo" | "preparo" | "riavvio") =>
    context.setState({
      status: "progress",
      step,
      from: context.from,
      version: context.version,
    });
  if (!nodeCompleto) {
    progress("installo");
    await ensureDependencies(context.root);
    progress("preparo");
    await ensureBuild(context.root);
  }
  progress("riavvio");
  context.restart();
}

function failed(context: UpdateContext, restoreError?: unknown) {
  context.setState({
    status: "failed",
    failedUpdate: { installed: context.from, attempted: context.version },
    message: restoreError
      ? "Ripristino non riuscito. Contatta chi ti aiuta."
      : `Aggiornamento non riuscito, stai usando ancora la versione ${context.from}`,
  });
}

export async function installClone(
  options: UpdateContext & { gitUrl: string; ref: string },
): Promise<void> {
  const { root, databaseFile, gitUrl, version, ref } = options;
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
  let checkedOut = false;
  const moved: string[] = [];
  try {
    await git(
      "fetch",
      "--no-tags",
      gitUrl,
      `refs/tags/v${version}:refs/tags/v${version}`,
    );
    await backupDatabase(options, temporaryBackup);
    await mkdir(updateDir, { recursive: true });
    checkedOut = true;
    await git("checkout", "--detach", `v${version}`);
    const nodeCompleto = await validatePackage(root, options);
    await writeRestart(options, "clone", ref, nodeCompleto);
    await rm(previous, { recursive: true, force: true });
    await mkdir(previous, { recursive: true });
    for (const name of ["node_modules", "dist"]) {
      if (existsSync(join(root, name))) {
        await rename(join(root, name), join(previous, name));
        moved.push(name);
      }
    }
    await prepareAndRestart(options, nodeCompleto);
  } catch (error) {
    options.onFailure?.(error);
    await rm(temporaryBackup, { force: true });
    try {
      if (checkedOut) await git("checkout", "--force", ref);
      for (const name of moved) {
        await rm(join(root, name), { recursive: true, force: true });
        await rename(join(previous, name), join(root, name));
      }
      await rm(join(updateDir, "riavvio.json"), { force: true });
      failed(options);
    } catch (restoreError) {
      options.onFailure?.(restoreError);
      console.error("Ripristino non riuscito", error, restoreError);
      failed(options, restoreError);
    }
  }
}

export async function installZip(
  options: UpdateContext & { zipUrl: string },
): Promise<void> {
  const { root, databaseFile, zipUrl } = options;
  const updateDir = join(root, ".aggiornamento");
  const previous = join(updateDir, "precedente");
  const staging = join(updateDir, "nuova");
  const temporaryBackup = join(
    dirname(databaseFile),
    "prima-di-aggiornamento.tmp.db",
  );
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
    const nodeCompleto = await validatePackage(staging, options);
    for (const name of ["avvia.sh", "avvia.command"]) {
      if (existsSync(join(staging, name)))
        await chmod(join(staging, name), 0o755);
    }
    await backupDatabase(options, temporaryBackup);
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
    await writeRestart(options, "zip", "", nodeCompleto);
    await prepareAndRestart(options, nodeCompleto);
  } catch (error) {
    options.onFailure?.(error);
    try {
      await rm(temporaryBackup, { force: true });
      for (const name of installed)
        await rm(join(root, name), { recursive: true, force: true });
      for (const name of [...moved, ...dependencies]) {
        await rm(join(root, name), { recursive: true, force: true });
        await rename(join(previous, name), join(root, name));
      }
      await rm(join(updateDir, "riavvio.json"), { force: true });
      failed(options);
    } catch (restoreError) {
      options.onFailure?.(restoreError);
      console.error("Ripristino non riuscito", error, restoreError);
      failed(options, restoreError);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
