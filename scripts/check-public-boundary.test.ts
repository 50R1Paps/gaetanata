import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, it } from "vitest";

const scanner = fileURLToPath(
  new URL("./check-public-boundary.ts", import.meta.url),
);
let dir: string;
function git(...args: string[]) {
  const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}
function scan(staged = false) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      scanner,
      dir,
      ...(staged ? ["--staged"] : []),
    ],
    { encoding: "utf8" },
  );
}
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "public-boundary-"));
  git("init", "-q");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

it("skips an absent private list and ignores untracked text", () => {
  writeFileSync(join(dir, "safe.txt"), "innocuo");
  writeFileSync(join(dir, "untracked.txt"), "Down" + "loads/fixture");
  git("add", "safe.txt");
  const result = scan();
  expect(result.status).toBe(0);
  expect(result.stdout).toContain("assente");
});

it("matches Unicode whole words and phrases, ignoring comments and substrings", () => {
  writeFileSync(
    join(dir, ".private-patterns"),
    "# commento\n\nAnn\nÉléna\nNome Finto\n",
  );
  writeFileSync(join(dir, "safe.txt"), "dannoso, Annalisa, élénaX, xan_1\n");
  git("add", "safe.txt");
  expect(scan().status).toBe(0);
  writeFileSync(join(dir, "safe.txt"), "ANN; élÉnA! Nome Finto.\n");
  const result = scan();
  expect(result.status).toBe(1);
  for (const match of ["ANN", "élÉnA", "Nome Finto"])
    expect(result.stderr).toContain(`safe.txt:1: ${match}`);
});

it("checks the index rather than hiding staged secrets behind safe working text", () => {
  writeFileSync(join(dir, ".private-patterns"), "ParolaSegreta\n");
  writeFileSync(join(dir, "safe.txt"), "ParolaSegreta");
  git("add", "safe.txt");
  writeFileSync(join(dir, "safe.txt"), "innocuo");
  expect(scan().status).toBe(0);
  expect(scan(true).status).toBe(1);
});

it("rejects all sensitive extensions and external test paths without flagging identifiers", () => {
  const extensions = [
    "docx",
    "doc",
    "dotx",
    "odt",
    "pdf",
    "xlsx",
    "xlsm",
    "xls",
    "csv",
    "db",
    "sqlite",
    "sqlite3",
    "sqlite-wal",
    "sqlite.backup",
  ];
  for (const extension of extensions)
    writeFileSync(join(dir, `fixture.${extension}`), Buffer.from([0, 1]));
  const forbidden = [
    "C:/" + "Users/fixture",
    "/" + "Users/fixture",
    "/" + "home/fixture",
    "Down" + "loads/fixture",
    "home" + "dir()",
    "C:\\\\" + "Users\\\\fixture",
  ].join("\n");
  writeFileSync(join(dir, "outside.test.ts"), forbidden);
  writeFileSync(join(dir, "safe.txt"), "const downloads = [];");
  git(
    "add",
    "outside.test.ts",
    "safe.txt",
    ...extensions.map((extension) => `fixture.${extension}`),
  );
  const result = scan();
  expect(result.status).toBe(1);
  expect(result.stderr.match(/Estensione non pubblicabile/g)).toHaveLength(14);
  for (let line = 1; line <= 6; line++)
    expect(result.stderr).toContain(`outside.test.ts:${line}:`);
  expect(result.stderr).not.toContain("safe.txt");
});
