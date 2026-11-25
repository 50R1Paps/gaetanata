import { spawn } from "node:child_process";
import { once } from "node:events";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";

it("does not check for releases in development without launcher IPC", async () => {
  const root = mkdtempSync(join(tmpdir(), "gaetanata-dev-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("address");
  const port = address.port;
  reservation.close();
  await once(reservation, "close");
  for (const name of [
    "server",
    "scripts",
    "src",
    "public",
    "index.html",
    "package.json",
    "vite.config.ts",
  ]) {
    if (existsSync(name)) cpSync(name, join(root, name), { recursive: true });
  }
  mkdirSync(join(root, "data"));
  symlinkSync(resolve("node_modules"), join(root, "node_modules"), "junction");
  const marker = join(root, "release-request");
  const preload = join(root, "preload.mjs");
  writeFileSync(
    preload,
    `import {writeFileSync} from 'node:fs'; const original = globalThis.fetch; globalThis.fetch = (...args) => { if (String(args[0]).includes('api.github.com')) { writeFileSync(${JSON.stringify(marker)}, 'requested'); throw new Error('network prohibited'); } return original(...args); };`,
  );
  const child = spawn(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--import",
      pathToFileURL(preload).href,
      join(root, "server/dev.ts"),
    ],
    {
      cwd: root,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe",
    },
  );
  let output = "";
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    await expect
      .poll(
        async () => {
          if (child.exitCode !== null)
            throw new Error(`Development server exited: ${output}`);
          try {
            return (await fetch(`${base}/api/health`)).status;
          } catch {
            return 0;
          }
        },
        { timeout: 30_000 },
      )
      .toBe(200);
    const response = await fetch(`${base}/api/window`, {
      method: "POST",
      body: JSON.stringify({ windowId: "dev" }),
    });
    expect((await response.json()).update.status).toBe("idle");
    expect(existsSync(marker)).toBe(false);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(root, { recursive: true, force: true });
  }
}, 45_000);
