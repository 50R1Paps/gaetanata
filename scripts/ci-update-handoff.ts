import { execFileSync, spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createServer as reservePort } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const temp = mkdtempSync(join(tmpdir(), "gaetanata-handoff-ci-"));
const source = join(temp, "source");
const repo = resolve(".");
const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, stdio: "pipe" }).toString().trim();
const fakeRelease = createServer((_req, res) =>
  res.end(JSON.stringify({ tag_name: "v99.0.0", body: "Versione sintetica" })),
);
fakeRelease.listen(0, "127.0.0.1");
await once(fakeRelease, "listening");
const releaseAddress = fakeRelease.address();
if (!releaseAddress || typeof releaseAddress === "string")
  throw new Error("Release address unavailable");
const releaseUrl = `http://127.0.0.1:${releaseAddress.port}`;
const local = process.env.GAETANATA_HANDOFF_LOCAL === "1";
const newerNode = local ? "22.17.0" : "24.11.0";
const deadlineMs = local ? 180_000 : 420_000;

async function waitFor<T>(
  description: string,
  read: () => Promise<T | undefined>,
): Promise<T> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    const value = await read();
    if (value !== undefined) return value;
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

function version(cwd: string, value: string, node: string) {
  for (const name of ["package.json", "package-lock.json"]) {
    const path = join(cwd, name);
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    pkg.version = value;
    if (name === "package.json") pkg.engines.node = `>=${node}`;
    else if (pkg.packages?.[""]) {
      pkg.packages[""].version = value;
      pkg.packages[""].engines.node = `>=${node}`;
    }
    writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  }
  writeFileSync(join(cwd, ".nvmrc"), `${node.split(".")[0]}\n`);
}

async function scenario(broken: boolean) {
  const app = join(temp, broken ? "broken" : "success");
  git(temp, "clone", "--no-hardlinks", source, app);
  const reserve = reservePort();
  reserve.listen(0, "127.0.0.1");
  await once(reserve, "listening");
  const address = reserve.address();
  if (!address || typeof address === "string")
    throw new Error("App address unavailable");
  const port = address.port;
  reserve.close();
  await once(reserve, "close");
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    PORT: String(port),
    GAETANATA_DATA_DIR: join(temp, broken ? "data-broken" : "data-success"),
    GAETANATA_NO_BROWSER: "1",
    ...(local ? {} : { GAETANATA_FORCE_RUNTIME: "1" }),
  };
  const child =
    process.platform === "win32"
      ? spawn(process.env.ComSpec ?? "cmd.exe", ["/d", "/c", "avvia.cmd"], {
          cwd: app,
          env,
          stdio: "inherit",
        })
      : spawn("bash", ["./avvia.sh"], { cwd: app, env, stdio: "inherit" });
  const health = async () => {
    try {
      const response = await fetch(`${base}/api/health`, {
        signal: AbortSignal.timeout(2000),
      });
      return response.ok
        ? ((await response.json()) as { version: string; node: string })
        : undefined;
    } catch {
      return undefined;
    }
  };
  const presence = async () => {
    const response = await fetch(`${base}/api/window`, {
      method: "POST",
      body: JSON.stringify({ windowId: "ci-handoff" }),
      signal: AbortSignal.timeout(2000),
    });
    return response.json() as Promise<{
      active: boolean;
      update: { status: string; message?: string; failedMessage?: string };
    }>;
  };
  try {
    await waitFor("old server", async () =>
      (await health())?.version === "98.0.0" ? true : undefined,
    );
    await waitFor("release", async () => {
      const result = await presence();
      return result.active && result.update.status === "available"
        ? true
        : undefined;
    });
    const response = await fetch(`${base}/api/update`, {
      method: "POST",
      body: JSON.stringify({ windowId: "ci-handoff" }),
    });
    if (response.status !== 202)
      throw new Error(
        `Update rejected: ${response.status} ${await response.text()}`,
      );
    const expected = broken ? "98.0.0" : "99.0.0";
    await waitFor("updated server", async () => {
      let state: { status: string; message?: string; failedMessage?: string };
      try {
        state = (await presence()).update;
      } catch {
        return undefined;
      }
      if (!broken && state.status === "failed")
        throw new Error(`Installation failed: ${state.message}`);
      const result = await health();
      if (!result || result.version !== expected) return undefined;
      if (broken) {
        if (
          !`${state.message ?? ""}${state.failedMessage ?? ""}`.includes(
            "Aggiornamento non riuscito",
          )
        )
          return undefined;
      } else if (
        Number(result.node.split(".")[0]) < Number(newerNode.split(".")[0])
      ) {
        throw new Error(`Wrong Node: ${result.node}`);
      }
      return result;
    });
    console.log(`${broken ? "rollback" : "handoff"}: ${expected} ready`);
  } finally {
    try {
      await fetch(`${base}/api/window/close`, {
        method: "POST",
        body: JSON.stringify({ windowId: "ci-handoff" }),
        signal: AbortSignal.timeout(2000),
      });
      await waitFor("server shutdown", async () =>
        (await health()) === undefined ? true : undefined,
      );
    } catch {
      child.kill();
    }
    if (child.exitCode === null) child.kill();
  }
}

try {
  git(temp, "clone", "--no-hardlinks", repo, source);
  git(source, "config", "user.email", "ci@example.invalid");
  git(source, "config", "user.name", "CI");
  if (local && process.platform === "win32") {
    const launcher = join(source, "scripts/avvia.ps1");
    const original = readFileSync(launcher, "utf8");
    const isolated = original.replace(
      / {2}\$shell = New-Object -ComObject WScript\.Shell[\s\S]*? {4}\$shortcut\.Save\(\)\r?\n {2}\}/,
      "",
    );
    if (isolated === original)
      throw new Error("Could not isolate local shortcuts");
    writeFileSync(launcher, isolated);
  }
  const installerFile = join(source, "server/install-update.ts");
  writeFileSync(
    installerFile,
    readFileSync(installerFile, "utf8").replace(
      "} catch (error) {\n    await rm(temporaryBackup",
      '} catch (error) {\n    console.error("Synthetic CI install error:", error);\n    await rm(temporaryBackup',
    ),
  );
  const releaseFile = join(source, "server/update.ts");
  const releaseSource = readFileSync(releaseFile, "utf8")
    .replace(
      "https://api.github.com/repos/50R1Paps/gaetanata/releases/latest",
      releaseUrl,
    )
    .replace(
      "https://github.com/50R1Paps/gaetanata.git",
      source.replaceAll("\\", "/"),
    );
  writeFileSync(releaseFile, releaseSource);
  const appFile = join(source, "server/app.ts");
  writeFileSync(
    appFile,
    readFileSync(appFile, "utf8").replace(
      "app: APP_ID,",
      "node: process.versions.node, app: APP_ID,",
    ),
  );
  version(source, "98.0.0", "22.17.0");
  git(source, "add", ".");
  git(source, "commit", "-m", "synthetic old version");
  version(source, "99.0.0", newerNode);
  git(source, "add", ".");
  git(source, "commit", "-m", "synthetic new version");
  git(source, "tag", "v99.0.0");
  git(source, "checkout", "HEAD~1");
  await scenario(false);
  git(source, "checkout", "v99.0.0");
  writeFileSync(join(source, "scripts/serve.ts"), "process.exit(1);\n");
  git(source, "add", "scripts/serve.ts");
  git(source, "commit", "-m", "synthetic broken version");
  git(source, "tag", "-f", "v99.0.0");
  git(source, "checkout", "HEAD~2");
  await scenario(true);
} finally {
  fakeRelease.closeAllConnections();
  fakeRelease.close();
  await once(fakeRelease, "close");
  rmSync(temp, { recursive: true, force: true });
}
