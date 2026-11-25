import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const script = fileURLToPath(
  new URL("./check-version-tag.ts", import.meta.url),
);

it("accepts only the tag matching the package version", () => {
  const dir = mkdtempSync(join(tmpdir(), "version-tag-"));
  try {
    writeFileSync(
      join(dir, "package.json"),
      JSON.stringify({ version: "1.2.3" }),
    );
    const check = (tag: string) =>
      spawnSync(process.execPath, ["--experimental-strip-types", script, tag], {
        cwd: dir,
        encoding: "utf8",
      });
    expect(check("v1.2.3").status).toBe(0);
    expect(check("v1.2.4").status).not.toBe(0);
    expect(check("1.2.3").status).not.toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 15_000);
