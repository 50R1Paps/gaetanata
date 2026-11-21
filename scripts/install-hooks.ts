import { spawnSync } from "node:child_process";
import { chmodSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
if (process.env.CI) {
  console.log("Hook: installazione saltata in CI.");
} else {
  const probe = spawnSync("git", ["rev-parse", "--show-toplevel"], {
    cwd: root,
    encoding: "utf8",
  });
  if (probe.status !== 0 || resolve(probe.stdout.trim()) !== resolve(root)) {
    console.log("Hook: Git assente (ZIP), installazione saltata.");
  } else {
    chmodSync(new URL("../.githooks/pre-commit", import.meta.url), 0o755);
    const result = spawnSync("git", ["config", "core.hooksPath", ".githooks"], {
      cwd: root,
      stdio: "inherit",
    });
    if (result.status !== 0) process.exitCode = result.status ?? 1;
  }
}
