import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

// Exercise real Git/Node processes, including their startup cost under load.
it.each(["zip", "ci", "git"])(
  "handles hook installation in %s installs",
  (mode) => {
    const dir = mkdtempSync(join(tmpdir(), "hook-install-"));
    try {
      mkdirSync(join(dir, "scripts"));
      mkdirSync(join(dir, ".githooks"));
      copyFileSync(
        new URL("./install-hooks.ts", import.meta.url),
        join(dir, "scripts", "install-hooks.ts"),
      );
      writeFileSync(
        join(dir, ".githooks", "pre-commit"),
        "#!/bin/sh\nexit 0\n",
      );
      if (mode !== "zip")
        expect(spawnSync("git", ["init", "-q"], { cwd: dir }).status).toBe(0);
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          join(dir, "scripts", "install-hooks.ts"),
        ],
        {
          env: { ...process.env, CI: mode === "ci" ? "1" : "" },
          encoding: "utf8",
        },
      );
      expect(result.status, result.stderr).toBe(0);
      if (mode === "git") {
        const config = spawnSync("git", ["config", "--get", "core.hooksPath"], {
          cwd: dir,
          encoding: "utf8",
        });
        expect(config.stdout.trim()).toBe(".githooks");
      } else {
        expect(result.stdout).toContain("saltata");
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  15_000,
);
