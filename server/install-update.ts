import { execFile, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { ensureBuild, ensureDependencies } from "../scripts/start.ts";
import type { UpdateState } from "../src/update.ts";

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
  if (!existsSync(join(root, ".git")))
    return {
      error:
        "Gli aggiornamenti delle installazioni ZIP non sono ancora disponibili. Contatta chi ti aiuta.",
    };
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
      if (existsSync(join(root, name)))
        await rename(join(root, name), join(previous, name));
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
    setState({
      status: "failed",
      message: `Aggiornamento non riuscito: ${error instanceof Error ? error.message : String(error)}. Contatta chi ti aiuta.`,
    });
  }
}
