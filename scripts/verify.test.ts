import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

// The runner starts up to four real Node subprocesses in addition to itself.
it.each(["", "check", "test", "build", "smoke"])(
  "streams output and preserves the failing exit code (%s)",
  (failed) => {
    const dir = mkdtempSync(join(tmpdir(), "verify-runner-"));
    try {
      const npm = join(dir, "npm.mjs");
      writeFileSync(
        npm,
        'const step = process.argv[3]; console.log("out:" + step); console.error("err:" + step); process.exit(step === process.env.FAIL_STEP ? 23 : 0);',
      );
      const runner = fileURLToPath(new URL("./verify.ts", import.meta.url));
      // Windows environment keys are case-insensitive; remove npm's uppercase alias too.
      const env = Object.fromEntries(
        Object.entries(process.env).filter(
          ([key]) => !["npm_execpath", "fail_step"].includes(key.toLowerCase()),
        ),
      );
      const result = spawnSync(
        process.execPath,
        ["--experimental-strip-types", runner],
        {
          env: { ...env, npm_execpath: npm, FAIL_STEP: failed },
          encoding: "utf8",
        },
      );
      expect(result.status, result.stdout + result.stderr).toBe(
        failed ? 23 : 0,
      );
      const steps = ["check", "test", "build", "smoke"];
      const last = failed ? steps.indexOf(failed) : 3;
      for (const [index, step] of steps.entries()) {
        if (index <= last) {
          expect(result.stdout).toContain(`out:${step}`);
          expect(result.stderr).toContain(`err:${step}`);
        } else {
          expect(result.stdout).not.toContain(`out:${step}`);
        }
      }
      expect(result.stdout.trim().split("\n").at(-1)).toContain(
        failed ? "FALLITA" : "Verifica: OK",
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  },
  15_000,
);
