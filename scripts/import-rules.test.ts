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
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const biome = fileURLToPath(
  new URL("../node_modules/@biomejs/biome/bin/biome", import.meta.url),
);
it("rejects each deliberate syntax violation in disposable files", () => {
  const dir = mkdtempSync(join(tmpdir(), "native-import-rules-"));
  try {
    const plugins = ["no-promise", "no-dynamic-import", "native-imports"];
    for (const plugin of plugins)
      copyFileSync(
        new URL(`./${plugin}.grit`, import.meta.url),
        join(dir, `${plugin}.grit`),
      );
    writeFileSync(
      join(dir, "biome.json"),
      JSON.stringify({ plugins: plugins.map((name) => `./${name}.grit`) }),
    );
    mkdirSync(join(dir, "server"));
    const lint = () =>
      spawnSync(
        process.execPath,
        [biome, "lint", "--only=plugin", join(dir, "server")],
        { cwd: dir, encoding: "utf8" },
      );
    const invalid = [
      "new Promise((resolve) => resolve(1));",
      "new Promise<number>((resolve) => resolve(1));",
      'import("./file.ts");',
      'import { item } from "./file";',
      'import type { Item } from "../file";',
      'export { item } from "./file.js";',
      'export * from "./file";',
      'import "./file";',
      'import data from "./file.json";',
      'import data from "./file.json" with { type: "text" };',
    ];
    for (const [index, code] of invalid.entries()) {
      writeFileSync(join(dir, "server", `invalid-${index}.ts`), code);
    }
    const rejected = lint();
    expect(rejected.status, rejected.stderr).toBe(1);
    invalid.forEach((_code, index) => {
      expect(rejected.stderr).toContain(`invalid-${index}.ts`);
      rmSync(join(dir, "server", `invalid-${index}.ts`));
    });
    const valid = [
      'import { item } from "./file.ts";',
      'import data from "./file.json" with { type: "json" };',
      'export { item } from "./file.ts";',
      'const text = "new Promise(() => {})";',
      '// import("./file")\nconst { promise } = Promise.withResolvers();',
    ];
    for (const [index, code] of valid.entries()) {
      writeFileSync(join(dir, "server", `valid-${index}.ts`), code);
    }
    const accepted = lint();
    expect(accepted.status, accepted.stderr).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
